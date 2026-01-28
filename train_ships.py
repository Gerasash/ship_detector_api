from pathlib import Path
from ultralytics import YOLO
import multiprocessing as mp

def main():
    # 1) Найди data.yaml там, где реально лежит датасет
    # Попробуем два популярных варианта папок:
    data_yaml = Path(r"C:\Users\Gera1\dev\ship_detector_api\datasets\v5\data.yaml").resolve()

    if not data_yaml.exists():
        raise FileNotFoundError(f"Не найден: {data_yaml}")


    # 3) Запуск обучения
    model = YOLO("yolov8n.pt")  # предобученная, дальше fine-tune
    model.train(
        data=str(data_yaml),
        epochs=50,
        imgsz=512,
        batch=8,
        device=0,
        workers=2,
        mosaic=0.0,
        mixup=0.0,
        copy_paste=0.0,
        auto_augment=None,
        erasing=0.0,
        project="runs/detect",
        name="ships_kaggle_v5_fast",
        patience=10,
        plots=True
    )
    # model.train(
    #     data=str(data_yaml),
    #     epochs=50,
    #     imgsz=640,
    #     batch=8,       # для 4GB VRAM норм, если OOM — ставь 4
    #     device=0,      # GPU
    #     workers=0,     # Windows: чтобы не ловить multiprocessing краши
    #     project="runs/detect",
    #     name="ships_port",
    #     patience=15,
    #     plots=True
    # )
if __name__ == "__main__":
    mp.set_start_method("spawn", force=True)
    main()
