from ultralytics import YOLO
import os

# Путь к датасету (замени на свой)
DATASET_PATH = "DataSet/data.yaml"

# Загружаем предобученную модель (не с нуля!)
model = YOLO("yolov8n.pt")  # nano — быстро, или yolov8s.pt для точности

# Обучаем (параметры под слабый GPU/CPU)
results = model.train(
    data=DATASET_PATH,      # твой датасет
    epochs=50,              # эпохи (30-100 хватит)
    imgsz=640,              # размер изображения
    batch=16,               # батч (меньше на слабом GPU)
    name="ships_port",      # имя эксперимента
    project="runs/train",   # папка с результатами
    device=0,               # GPU 0 (или 'cpu')
    patience=10,            # early stopping
    save=True               # сохранять best.pt
)

# Валидация
metrics = model.val()
print(f"mAP50: {metrics.box.map50:.3f}")

# Экспорт для API (ONNX для скорости)
model.export(format="onnx")
