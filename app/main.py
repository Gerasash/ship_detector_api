from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
from .models import ShipDetector

app = FastAPI(title="Ship Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = ShipDetector()

@app.get("/")
async def root():
    return {"message": "🚀 Ship Detection API готов!", "endpoints": ["/docs", "/detect"]}

@app.post("/detect")
async def detect_ships(file: UploadFile = File(...)):
    """Детекция кораблей на изображении"""
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Только изображения!")
    
    start_time = time.time()
    
    try:
        contents = await file.read()
        results = detector.detect_ships(contents)
        processing_time = time.time() - start_time
        
        return {
            "success": True,
            "processing_time": round(processing_time, 3),
            "results": results
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/docs")
async def docs():
    return {"message": "Перейди на http://localhost:8001/docs для Swagger UI"}
