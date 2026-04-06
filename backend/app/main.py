import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.DEBUG if os.environ.get("NUTRIVISION_DEBUG") else logging.INFO,
    format="%(levelname)s %(name)s: %(message)s",
)
from .database import engine, Base, SessionLocal
from .routers import food
from . import models

# Create all DB tables
Base.metadata.create_all(bind=engine)

# Default user for scans that pass user_id=1 (no auth UI yet)
_db = SessionLocal()
try:
    if _db.query(models.User).filter(models.User.id == 1).first() is None:
        _db.add(
            models.User(
                id=1,
                name="You",
                age=30,
                weight=70.0,
                height=175.0,
                goal="maintain",
            )
        )
        _db.commit()
finally:
    _db.close()

app = FastAPI(title="Jarvis Food & Nutrition AI", description="Production-level food detection and tracking system")

# Enable CORS for React frontend (Vite runs on 5173 by default)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(food.router, prefix="/api/food", tags=["Food Detection"])

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Jarvis Systems Online"}
    
# Speech synthesis endpoint (Jarvis voice)
import pyttsx3
from fastapi import BackgroundTasks

def speak_text(text: str):
    try:
        # Re-initialize engine per thread in some OS needed, or use a global engine with a lock
        engine = pyttsx3.init()
        engine.setProperty("rate", 175)
        voices = engine.getProperty('voices')
        # Try finding a male/jarvis like voice
        for voice in voices:
            if "david" in voice.name.lower() or "male" in voice.name.lower():
                engine.setProperty('voice', voice.id)
                break
        engine.say(text)
        engine.runAndWait()
    except Exception as e:
        print(f"Voice synthesis skipped: {e}")

@app.post("/api/voice/speak")
def run_voice(text: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(speak_text, text)
    return {"status": "speaking", "text": text}
