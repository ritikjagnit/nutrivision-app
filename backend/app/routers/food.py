from fastapi import APIRouter, File, UploadFile, Depends
from sqlalchemy.orm import Session, joinedload
from typing import List
from ..database import get_db
from ..schemas import DetectionResponse, DetectedItemBase, ScanHistoryListItem
from ..ml.detector import detector
from .. import models
import os

router = APIRouter()


@router.get("/history", response_model=List[ScanHistoryListItem])
def list_scan_history(
    user_id: int = 1,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    scans = (
        db.query(models.ScanHistory)
        .options(joinedload(models.ScanHistory.items))
        .filter(models.ScanHistory.user_id == user_id)
        .order_by(models.ScanHistory.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return scans


@router.post("/detect", response_model=DetectionResponse)
async def detect_food(file: UploadFile = File(...), user_id: int = 1, db: Session = Depends(get_db)):
    image_bytes = await file.read()
    
    # 1. AI Detection
    artifact = detector.detect_foods(image_bytes)
    items = artifact.items
    img_base64 = artifact.image_base64
    
    # Calculate Totals
    totals = {
        "total_calories": sum([i["calories"] for i in items]),
        "total_protein": sum([i["protein"] for i in items]),
        "total_carbs": sum([i["carbs"] for i in items]),
        "total_fat": sum([i["fat"] for i in items])
    }
    
    # 2. AI Recommendation Logic (Jarvis style)
    recommendation = "Great balance! Enjoy your meal."
    if totals["total_calories"] == 0:
        recommendation = "No recognizable food detected. Please try a clearer image."
    elif totals["total_carbs"] > 80:
        recommendation = "Warning: High carbohydrate content detected. Consider balancing with more protein."
    elif totals["total_protein"] < 10 and totals["total_calories"] > 300:
        recommendation = "This meal is relatively low in protein. Maybe add some lean meats or beans."
    elif totals["total_fat"] > 40:
        recommendation = "High fat content detected. Watch your portion sizes!"
        
    # 3. Save to History (Using local storage for images instead of base64 to save DB space, but for MVP we skip local saving and just log stats)
    # Actually saving image bytes locally
    save_dir = "data/uploads"
    os.makedirs(save_dir, exist_ok=True)
    img_path = f"{save_dir}/{file.filename}_{user_id}.jpg"
    with open(img_path, "wb") as f:
        f.write(image_bytes)
        
    db_scan = models.ScanHistory(
        user_id=user_id,
        image_path=img_path,
        total_calories=totals["total_calories"],
        total_protein=totals["total_protein"],
        total_carbs=totals["total_carbs"],
        total_fat=totals["total_fat"]
    )
    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)
    
    _db_keys = {
        "food_name",
        "confidence",
        "portion_size_grams",
        "calories",
        "protein",
        "carbs",
        "fat",
    }
    for item in items:
        row = {k: item[k] for k in _db_keys if k in item}
        db_item = models.DetectedItem(scan_id=db_scan.id, **row)
        db.add(db_item)
    db.commit()
    
    return DetectionResponse(
        message="Detection successful",
        image_base64=f"data:image/jpeg;base64,{img_base64}",
        items=items,
        totals=totals,
        recommendation=recommendation,
        primary_prediction=artifact.primary_prediction,
        debug_raw_detections=artifact.debug_raw_detections,
    )
