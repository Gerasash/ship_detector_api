from ultralytics import YOLO
import numpy as np
import cv2
import tempfile
import os

class ShipDetector:
    def __init__(self, weights_path=r"runs\detect\runs\detect\ships_kaggle_v5_fast2\weights\best.pt", device=0, conf=0.35):
        self.model = YOLO(weights_path)
        self.device = device
        self.conf = conf

    def detect_image_bytes(self, image_bytes: bytes):
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        res = self.model.predict(img, device=self.device, conf=self.conf, verbose=False)[0]

        ships = []
        names = res.names
        for b in res.boxes:
            cls_id = int(b.cls[0])
            cls_name = names[cls_id]  # для твоего датасета обычно "ship"
            x1, y1, x2, y2 = map(float, b.xyxy[0])
            ships.append({"class": cls_name, "conf": float(b.conf[0]), "bbox": [x1, y1, x2, y2]})

        return {"total_ships": len(ships), "has_ships": len(ships) > 0, "ships": ships}

    def analyze_video_file(self, video_path: str, max_frames: int = 300):
        cap = cv2.VideoCapture(video_path)
        total_frames = 0
        frames_with_ships = 0
        max_ships = 0

        try:
            while total_frames < max_frames:
                ok, frame = cap.read()
                if not ok:
                    break
                total_frames += 1
                res = self.model.predict(frame, device=self.device, conf=self.conf, verbose=False)[0]
                count = len(res.boxes) if res.boxes is not None else 0
                if count > 0:
                    frames_with_ships += 1
                max_ships = max(max_ships, count)

            return {"total_frames": total_frames, "frames_with_ships": frames_with_ships, "max_ships_per_frame": max_ships}
        finally:
            cap.release()
