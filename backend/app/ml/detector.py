"""
Food detection pipeline (production-oriented).

ROOT CAUSE (why everything looked like "sandwich"):
- YOLOv8n is a *COCO* detector, not a food specialist. "sandwich" is a broad COCO class and is a
  very common false positive on generic meal photos.
- The old pipeline used conf > 0.3 and kept *every* box, so multiple weak "sandwich" hits
  dominated the UI even when other classes were present.

FIXES:
- Build the allowlist from model.names ∩ nutrition_db (no brittle hard-coded class indices).
- Run YOLO at a low log threshold, then apply a production confidence floor (default 0.5).
- Keep only the highest-confidence box per class (kills duplicate sandwich rows).
- Optional ImageNet (ResNet50) second opinion when YOLO is empty or only a weak sandwich.
- Expose primary_prediction { food, confidence, alternatives } + optional debug_raw_detections.

Retrain path (summary): export COCO or Food-101/UECFOOD-100 with YOLO labels; train yolov8s
or yolov8m on that data; point NUTRIVISION_YOLO_WEIGHTS to your best.pt.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from PIL import Image
from ultralytics import YOLO

logger = logging.getLogger(__name__)

_RAW_LOG_CONF = float(os.environ.get("NUTRIVISION_RAW_LOG_CONF", "0.08"))
_MIN_ACCEPT_CONF = float(os.environ.get("NUTRIVISION_MIN_CONF", "0.5"))
_IOU_NMS = float(os.environ.get("NUTRIVISION_IOU", "0.5"))
_IMGSZ = int(os.environ.get("NUTRIVISION_IMGSZ", "640"))
_USE_AUGMENT = os.environ.get("NUTRIVISION_AUGMENT", "0") == "1"
_USE_INET_SECOND_OPINION = os.environ.get("NUTRIVISION_INET_SECOND_OPINION", "1") != "0"
_SANDWICH_INET_TRIGGER = float(os.environ.get("NUTRIVISION_SANDWICH_INET_TRIGGER", "0.62"))
_INET_MIN_PROB = float(os.environ.get("NUTRIVISION_INET_MIN_PROB", "0.12"))
_DEBUG = os.environ.get("NUTRIVISION_DEBUG", "").lower() in ("1", "true", "yes")

UNKNOWN_LABEL = "Unknown Food"
YOLO_MODEL = os.environ.get("NUTRIVISION_YOLO_WEIGHTS", "yolov8n.pt")

base_dir = Path(__file__).resolve().parent.parent.parent
db_path = base_dir / "data" / "nutrition_db.json"

try:
    with open(db_path, "r", encoding="utf-8") as f:
        NUTRITION_DB: dict[str, dict[str, Any]] = json.load(f)
except FileNotFoundError:
    NUTRITION_DB = {}


def _map_imagenet_label_to_food(label: str) -> str | None:
    l = label.lower()
    if "pineapple" in l:
        return None
    if "granny smith" in l:
        return "apple"
    if "hot dog" in l or "hotdog" in l:
        return "hot dog"
    if "pizza" in l:
        return "pizza"
    if "doughnut" in l or "donut" in l:
        return "donut"
    if "broccoli" in l:
        return "broccoli"
    if "carrot" in l:
        return "carrot"
    if "banana" in l:
        return "banana"
    if "orange" in l:
        return "orange"
    if "sandwich" in l:
        return "sandwich"
    if "cake" in l or "cheesecake" in l:
        return "cake"
    return None


@dataclass
class DetectionArtifact:
    items: list[dict[str, Any]]
    image_base64: str
    primary_prediction: dict[str, Any]
    debug_raw_detections: list[dict[str, Any]] | None = None


class FoodDetector:
    def __init__(self) -> None:
        self.model: YOLO | None = None
        self._food_class_ids: set[int] = set()
        self._inet: torch.nn.Module | None = None
        self._inet_transform = None
        self._inet_categories: list[str] | None = None
        try:
            self.model = YOLO(YOLO_MODEL)
            self._food_class_ids = self._build_food_indices()
            logger.info(
                "Loaded YOLO (%s). %d classes intersect nutrition_db.",
                YOLO_MODEL,
                len(self._food_class_ids),
            )
        except Exception as e:
            logger.exception("Failed to load YOLO: %s", e)
            self.model = None

    def _build_food_indices(self) -> set[int]:
        assert self.model is not None
        names: dict[int, str] = self.model.names  # type: ignore[assignment]
        return {i for i, n in names.items() if n in NUTRITION_DB}

    def _ensure_inet(self) -> bool:
        if not _USE_INET_SECOND_OPINION:
            return False
        if self._inet is not None:
            return True
        try:
            from torchvision.models import ResNet50_Weights, resnet50

            w = ResNet50_Weights.IMAGENET1K_V2
            net = resnet50(weights=w)
            net.eval()
            self._inet = net
            self._inet_transform = w.transforms()
            self._inet_categories = w.meta["categories"]
            logger.info("Loaded ImageNet ResNet50 second-opinion head.")
            return True
        except Exception as e:
            logger.warning("ImageNet second opinion unavailable: %s", e)
            return False

    def _imagenet_best_food(self, pil_rgb: Image.Image) -> tuple[str, float, str] | None:
        if not self._ensure_inet() or self._inet is None or self._inet_transform is None:
            return None
        assert self._inet_categories is not None
        ch = pil_rgb.convert("RGB")
        t = self._inet_transform(ch).unsqueeze(0)
        with torch.inference_mode():
            logits = self._inet(t)
            probs = torch.softmax(logits, dim=1)[0]
        if _DEBUG:
            t5 = probs.topk(5)
            parts = [f"{self._inet_categories[i]}:{float(p):.3f}" for p, i in zip(t5.values, t5.indices)]
            logger.info("ImageNet top-5: %s", ", ".join(parts))
        topk = min(20, probs.numel())
        vals, idx = probs.topk(topk)
        for p, i in zip(vals.tolist(), idx.tolist()):
            raw = self._inet_categories[i]
            food = _map_imagenet_label_to_food(raw)
            if food is None or p < _INET_MIN_PROB:
                continue
            logger.debug("ImageNet candidate: %s p=%.3f → food=%s", raw, p, food)
            return food, float(p), raw
        return None

    def _dummy_fallback(self, img_bgr: np.ndarray) -> DetectionArtifact:
        logger.warning("Using dummy fallback (YOLO not loaded).")
        item = {
            "food_name": "pizza",
            "confidence": 0.95,
            "portion_size_grams": 200.0,
            "calories": 532.0,
            "protein": 22.0,
            "carbs": 66.0,
            "fat": 20.0,
            "evidence": "dummy",
        }
        _, buf = cv2.imencode(".jpg", img_bgr)
        b64 = base64.b64encode(buf).decode("utf-8")
        return DetectionArtifact(
            items=[item],
            image_base64=b64,
            primary_prediction={
                "food": "pizza",
                "confidence": 0.95,
                "alternatives": [],
                "unknown_reason": None,
                "evidence": "dummy",
            },
        )

    def _decode_bgr(self, image_bytes: bytes) -> tuple[np.ndarray, Image.Image]:
        pil = Image.open(io.BytesIO(image_bytes))
        rgb = np.array(pil.convert("RGB"))
        if rgb.ndim == 2:
            rgb = np.stack([rgb, rgb, rgb], axis=-1)
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        return bgr, Image.fromarray(rgb)

    def _nutrition_item(
        self,
        class_name: str,
        confidence: float,
        xyxy: tuple[float, float, float, float],
        img_h: int,
        img_w: int,
        evidence: str,
    ) -> dict[str, Any]:
        base_info = NUTRITION_DB[class_name]
        x1, y1, x2, y2 = xyxy
        box_area = max(0.0, (x2 - x1) * (y2 - y1))
        img_area = float(max(1, img_h * img_w))
        area_ratio = box_area / img_area
        multiplier = float(np.clip(area_ratio * 4.0, 0.5, 3.0))
        portion = base_info["baseline_grams"] * multiplier
        factor = portion / 100.0
        return {
            "food_name": class_name,
            "confidence": round(confidence, 4),
            "portion_size_grams": round(portion, 1),
            "calories": round(base_info["calories"] * factor, 1),
            "protein": round(base_info["protein"] * factor, 1),
            "carbs": round(base_info["carbs"] * factor, 1),
            "fat": round(base_info["fat"] * factor, 1),
            "evidence": evidence,
        }

    def detect_foods(self, image_bytes: bytes) -> DetectionArtifact:
        img_bgr, pil_rgb = self._decode_bgr(image_bytes)
        img_h, img_w = img_bgr.shape[:2]

        if self.model is None:
            return self._dummy_fallback(img_bgr)

        results = self.model.predict(
            source=img_bgr,
            conf=_RAW_LOG_CONF,
            iou=_IOU_NMS,
            imgsz=_IMGSZ,
            augment=_USE_AUGMENT,
            verbose=False,
            max_det=25,
        )

        raw_debug: list[dict[str, Any]] = []
        candidates: list[tuple[int, str, float, tuple[float, float, float, float]]] = []

        for r in results:
            if r.boxes is None or len(r.boxes) == 0:
                continue
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                name = self.model.names[cls_id]  # type: ignore[index]
                xyxy = tuple(box.xyxy[0].tolist())
                raw_debug.append(
                    {
                        "class_id": cls_id,
                        "name": name,
                        "confidence": round(confidence, 4),
                        "in_nutrition_db": name in NUTRITION_DB,
                        "in_food_allowlist": cls_id in self._food_class_ids,
                    }
                )
                if cls_id not in self._food_class_ids or confidence < _MIN_ACCEPT_CONF:
                    continue
                candidates.append((cls_id, name, confidence, xyxy))

        if _DEBUG:
            logger.info("RAW YOLO (conf≥%.3f log, accept≥%.2f): %s", _RAW_LOG_CONF, _MIN_ACCEPT_CONF, raw_debug)

        best_by_class: dict[int, tuple[str, float, tuple[float, float, float, float]]] = {}
        for cls_id, name, conf, xyxy in candidates:
            prev = best_by_class.get(cls_id)
            if prev is None or conf > prev[1]:
                best_by_class[cls_id] = (name, conf, xyxy)

        items: list[dict[str, Any]] = []
        item_boxes: list[tuple[int, int, int, int] | None] = []
        for name, conf, xyxy in best_by_class.values():
            x1, y1, x2, y2 = map(int, xyxy)
            items.append(self._nutrition_item(name, conf, xyxy, img_h, img_w, evidence="yolo"))
            item_boxes.append((x1, y1, x2, y2))

        order = sorted(range(len(items)), key=lambda i: -items[i]["confidence"])
        items = [items[i] for i in order]
        item_boxes = [item_boxes[i] for i in order]

        inet_hint = self._imagenet_best_food(pil_rgb) if _USE_INET_SECOND_OPINION else None

        if not items and inet_hint:
            food_k, prob, raw_lab = inet_hint
            logger.info("No YOLO food; ImageNet → %s (p=%.3f, %s)", food_k, prob, raw_lab)
            items = [
                self._nutrition_item(
                    food_k,
                    prob,
                    (0.0, 0.0, float(img_w), float(img_h)),
                    img_h,
                    img_w,
                    evidence="imagenet_only",
                )
            ]
            item_boxes = [None]
        elif items and items[0]["food_name"] == "sandwich" and items[0]["confidence"] < _SANDWICH_INET_TRIGGER:
            if inet_hint:
                food_k, prob, raw_lab = inet_hint
                if food_k != "sandwich" and prob >= max(_INET_MIN_PROB, items[0]["confidence"] * 0.85):
                    logger.info(
                        "Disambiguating sandwich (%.3f) → %s via ImageNet (%.3f, %s)",
                        items[0]["confidence"],
                        food_k,
                        prob,
                        raw_lab,
                    )
                    merged = max(items[0]["confidence"], prob)
                    items[0] = self._nutrition_item(
                        food_k,
                        merged,
                        (0.0, 0.0, float(img_w), float(img_h)),
                        img_h,
                        img_w,
                        evidence="yolo+imagenet_fusion",
                    )
                    item_boxes[0] = None

        for i, bb in enumerate(item_boxes):
            it = items[i]
            if bb is not None:
                x1, y1, x2, y2 = bb
                cv2.rectangle(img_bgr, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(
                    img_bgr,
                    f"{it['food_name']} {it['confidence']:.2f}",
                    (x1, max(0, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.85,
                    (0, 255, 0),
                    2,
                )
            else:
                line = f"{it['food_name']} {it['confidence']:.2f} ({it.get('evidence', '')})"
                y0 = 28 + i * 26
                cv2.putText(
                    img_bgr,
                    line,
                    (10, y0),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0, 255, 255),
                    2,
                )

        _, buf = cv2.imencode(".jpg", img_bgr)
        img_b64 = base64.b64encode(buf).decode("utf-8")

        primary, conf, alts, unknown_reason, evidence = self._primary_block(items)

        return DetectionArtifact(
            items=items,
            image_base64=img_b64,
            primary_prediction={
                "food": primary,
                "confidence": conf,
                "alternatives": alts,
                "unknown_reason": unknown_reason,
                "evidence": evidence,
            },
            debug_raw_detections=raw_debug if _DEBUG else None,
        )

    def _primary_block(
        self, items: list[dict[str, Any]]
    ) -> tuple[str, float, list[str], str | None, str]:
        if not items:
            return (
                UNKNOWN_LABEL,
                0.0,
                [],
                f"No food class ≥ {_MIN_ACCEPT_CONF} in the COCO↔nutrition allowlist.",
                "none",
            )
        top = items[0]
        alts = [x["food_name"] for x in items[1:3] if x["food_name"] != top["food_name"]]
        return (
            top["food_name"],
            float(top["confidence"]),
            alts,
            None,
            str(top.get("evidence", "yolo")),
        )


detector = FoodDetector()
