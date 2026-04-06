from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    weight = Column(Float)
    height = Column(Float)
    goal = Column(String) # e.g., weight loss, muscle gain
    
    scans = relationship("ScanHistory", back_populates="user")

class ScanHistory(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    image_path = Column(String)
    
    total_calories = Column(Float, default=0.0)
    total_protein = Column(Float, default=0.0)
    total_carbs = Column(Float, default=0.0)
    total_fat = Column(Float, default=0.0)
    
    user = relationship("User", back_populates="scans")
    items = relationship("DetectedItem", back_populates="scan")

class DetectedItem(Base):
    __tablename__ = "detected_items"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scans.id"))
    food_name = Column(String, index=True)
    confidence = Column(Float)
    portion_size_grams = Column(Float)
    
    calories = Column(Float)
    protein = Column(Float)
    carbs = Column(Float)
    fat = Column(Float)
    
    scan = relationship("ScanHistory", back_populates="items")
