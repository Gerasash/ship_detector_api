from ultralytics import YOLO
import cv2
import tempfile
import os

class ShipDetector:
    def __init__(self):
        self.model = YOLO("runs/train/ships_port/weights/best.pt")

    # def __init__(self):
    #     print("🔄 Загружаем YOLOv8...")
    #     self.model = YOLO('yolov8n.pt')
    #     print("✅ YOLO готов!")
    
    def detect_ships(self, image_bytes):
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name
        
        try:
            # Детекция
            results = self.model(tmp_path, verbose=False)
            
            # Подсчет кораблей (классы 8=boat, 9=ship)
            ships = 0
            confidences = []
            
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        cls = int(box.cls[0])
                        conf = float(box.conf[0])
                        if cls in [8, 9] and conf > 0.5:  # boat/ship
                            ships += 1
                            confidences.append(conf)
            
            return {
                "total_ships": ships,
                "has_ships": ships > 0,
                "avg_confidence": sum(confidences)/len(confidences) if confidences else 0
            }
        finally:
            os.unlink(tmp_path)
