from ultralytics import YOLO
import numpy as np
import cv2

class ShipDetector:
    def __init__(self, weights_path=r"runs\detect\runs\detect\ships_kaggle_v5_fast2\weights\best.pt", device=0, conf=0.35):
        self.model = YOLO(weights_path)
        self.device = device
        self.conf = conf

    def detect_image_bytes(self, image_bytes: bytes):
        """Детекция на изображении из bytes"""
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        res = self.model.predict(img, device=self.device, conf=self.conf, verbose=False)[0]

        ships = []
        names = res.names
        for b in res.boxes:
            cls_id = int(b.cls[0])
            cls_name = names[cls_id]
            x1, y1, x2, y2 = map(float, b.xyxy[0])
            ships.append({"class": cls_name, "conf": float(b.conf[0]), "bbox": [x1, y1, x2, y2]})

        return {"total_ships": len(ships), "has_ships": len(ships) > 0, "ships": ships}

    def analyze_video_file(self, video_path: str, sample_rate: int = 5, max_frames: int = 300):
        """Анализ видео с подсчётом кораблей"""
        cap = cv2.VideoCapture(video_path)
        total_frames_processed = 0
        frames_with_ships = 0
        max_ships = 0
        total_ships_detected = 0
        
        frame_idx = 0

        try:
            while total_frames_processed < max_frames:
                ok, frame = cap.read()
                if not ok:
                    break
                
                frame_idx += 1
                
                if frame_idx % sample_rate != 0:
                    continue
                
                total_frames_processed += 1
                res = self.model.predict(frame, device=self.device, conf=self.conf, verbose=False)[0]
                count = len(res.boxes) if res.boxes is not None else 0
                
                if count > 0:
                    frames_with_ships += 1
                    total_ships_detected += count
                
                max_ships = max(max_ships, count)

            avg_ships = total_ships_detected / total_frames_processed if total_frames_processed > 0 else 0

            return {
                "total_frames_processed": total_frames_processed,
                "frames_with_ships": frames_with_ships,
                "max_ships_per_frame": max_ships,
                "avg_ships_per_frame": round(avg_ships, 2),
                "total_ships_detected": total_ships_detected
            }
        finally:
            cap.release()
