from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from datetime import datetime

class UserBase(BaseModel):
    name: str
    age: int
    weight: float
    height: float
    goal: str

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    class Config:
        from_attributes = True

class DetectedItemBase(BaseModel):
    food_name: str
    confidence: float
    portion_size_grams: float
    calories: float
    protein: float
    carbs: float
    fat: float
    evidence: Optional[str] = None  # yolo | imagenet_only | yolo+imagenet_fusion (not stored in DB)

class DetectedItem(DetectedItemBase):
    id: int
    scan_id: int
    class Config:
        from_attributes = True

class ScanHistoryBase(BaseModel):
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float

class ScanHistoryCreate(ScanHistoryBase):
    image_path: str

class ScanHistory(ScanHistoryBase):
    id: int
    user_id: int
    timestamp: datetime
    image_path: str
    items: List[DetectedItem] = []
    class Config:
        from_attributes = True

class PrimaryPrediction(BaseModel):
    food: str
    confidence: float
    alternatives: List[str] = Field(default_factory=list)
    unknown_reason: Optional[str] = None
    evidence: Optional[str] = None


class DetectionResponse(BaseModel):
    message: str
    image_base64: Optional[str] = None
    items: List[DetectedItemBase]
    totals: ScanHistoryBase
    recommendation: str
    primary_prediction: PrimaryPrediction
    debug_raw_detections: Optional[List[Dict[str, Any]]] = None


class ScanHistoryListItem(BaseModel):
    id: int
    user_id: int
    timestamp: datetime
    image_path: str
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    items: List[DetectedItemBase]

    class Config:
        from_attributes = True
