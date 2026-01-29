from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import time
import tempfile
import os

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
    return {"message": "Ship Detection API", "endpoints": ["/docs", "/detect/image", "/detect/video", "/ws/stream"]}

@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Только изображения")

    start = time.time()
    img_bytes = await file.read()
    results = detector.detect_image_bytes(img_bytes)
    return {"success": True, "processing_time": round(time.time() - start, 3), "results": results}

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
        results = detector.analyze_video_file(tmp_path, sample_rate=5, max_frames=300)  # ограничение для скорости
        return {"success": True, "processing_time": round(time.time() - start, 3), "results": results}
    finally:
        os.remove(tmp_path)

@app.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket):
    await websocket.accept()
    # Это “контрольный” стрим: клиент шлёт JPEG кадры, сервер отвечает детекцией.
    # Так проще всего под Next.js, чем лезть в VideoCapture с сервера.
    try:
        while True:
            frame_bytes = await websocket.receive_bytes()
            results = detector.detect_image_bytes(frame_bytes)
            await websocket.send_json(results)
    except Exception:
        # клиент закрылся — выходим молча
        return
