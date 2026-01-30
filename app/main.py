from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from typing import Dict, Any
import time
import tempfile
import os

from .models import ShipDetector
from .reports import ReportGenerator



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
    return {"message": "Ship Detection API", "endpoints": ["/docs", "/detect/image", "/detect/video", "/ws/stream", "/export/pdf", "/export/excel"]}


@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Только изображения")

    start = time.time()
    img_bytes = await file.read()
    results = detector.detect_image_bytes(img_bytes)
    processing_time = time.time() - start
    
    results_with_time = {**results, "processing_time": processing_time}
    return {"success": True, "processing_time": round(processing_time, 3), "results": results_with_time}


@app.post("/detect/video")
async def detect_video(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("video/"):
        raise HTTPException(400, "Только видео")

    start = time.time()
    suffix = os.path.splitext(file.filename)[1] or ".mp4"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        results = detector.analyze_video_file(tmp_path, sample_rate=5, max_frames=300)
        processing_time = time.time() - start
        
        results_with_time = {**results, "processing_time": processing_time}
        return {"success": True, "processing_time": round(processing_time, 3), "results": results_with_time}
    finally:
        os.remove(tmp_path)


@app.post("/export/pdf")
async def export_pdf(data: Dict[str, Any]):
    """Генерирует PDF отчет"""
    try:
        generator = ReportGenerator(data.get("results", {}))
        pdf_buffer = generator.generate_pdf()
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=ship_detection_report.pdf"}
        )
    except Exception as e:
        raise HTTPException(500, f"Ошибка генерации PDF: {str(e)}")

@app.post("/export/excel")
async def export_excel(data: Dict[str, Any]):
    """Генерирует Excel отчет"""
    try:
        generator = ReportGenerator(data.get("results", {}))
        excel_buffer = generator.generate_excel()
        
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=ship_detection_report.xlsx"}
        )
    except Exception as e:
        raise HTTPException(500, f"Ошибка генерации Excel: {str(e)}")


@app.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            frame_bytes = await websocket.receive_bytes()
            results = detector.detect_image_bytes(frame_bytes)
            await websocket.send_json(results)
    except Exception:
        return
