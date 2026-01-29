
import os
from ultralytics import YOLO

if __name__ == '__main__':
    print("📥 Скачиваем датасет КОРАБЛЕЙ...")
    
    # Автоматически скачивает + подготавливает датасет
    model = YOLO("yolov8n.pt")
    
    # Ships датасет (Roboflow или Ultralytics)
    model.train(
        data="https://github.com/ultralytics/assets/releases/download/v8.3.0/ships.zip",
        epochs=1,  # только скачивание
        project="dataset",
        name="ships"
    )
