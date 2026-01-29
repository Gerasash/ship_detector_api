"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";

export default function StreamPage() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const wsUrl = apiBase.replace("http", "ws") + "/ws/stream";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [stats, setStats] = useState({ fps: 0, ships: 0 });
  const [error, setError] = useState<string | null>(null);

  // Рисование bbox на canvas
  function drawBboxOnCanvas(data: any) {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Рисуем текущий кадр видео
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Рисуем bbox если есть
    if (data.ships && data.ships.length > 0) {
      data.ships.forEach((ship: any) => {
        const [x1, y1, x2, y2] = ship.bbox;
        const w = x2 - x1;
        const h = y2 - y1;

        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, w, h);

        const label = `${ship.class} ${(ship.conf * 100).toFixed(0)}%`;
        ctx.font = "bold 16px Arial";
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
        ctx.fillRect(x1, y1 > 20 ? y1 - 20 : y1, textWidth + 8, 20);

        ctx.fillStyle = "#000";
        ctx.fillText(label, x1 + 4, y1 > 20 ? y1 - 5 : y1 + 15);
      });
    }

    setStats((prev) => ({ ...prev, ships: data.total_ships }));
  }

  // Обработка кадров
  function processFrames() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ws = wsRef.current;

    if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) {
      console.error("❌ processFrames: нет видео, canvas или ws");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("❌ Не удалось получить canvas context");
      return;
    }

    // Устанавливаем размеры canvas
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    console.log(`✅ Canvas размер: ${canvas.width}x${canvas.height}`);

    let lastFrameTime = Date.now();
    let frameCount = 0;
    let isProcessing = false;

    function captureAndSend() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log("WebSocket закрыт, останавливаем отправку");
        return;
      }

      if (isProcessing) {
        setTimeout(captureAndSend, 100);
        return;
      }

      isProcessing = true;

      // Рисуем текущий кадр на canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Конвертируем в JPEG
      canvas.toBlob(
        (blob) => {
          if (blob && ws.readyState === WebSocket.OPEN) {
            blob.arrayBuffer().then((buffer) => {
              ws.send(buffer);
              isProcessing = false;
            });
          } else {
            isProcessing = false;
          }
        },
        "image/jpeg",
        0.7,
      );

      // Подсчёт FPS
      frameCount++;
      const now = Date.now();
      if (now - lastFrameTime > 1000) {
        console.log(`📊 FPS отправки: ${frameCount}`);
        setStats((prev) => ({ ...prev, fps: frameCount }));
        frameCount = 0;
        lastFrameTime = now;
      }

      setTimeout(captureAndSend, 100);
    }

    captureAndSend();
  }

  // Запуск стрима
  async function startStream() {
    setError(null);

    try {
      console.log("📹 Запрашиваем камеру...");

      // Запрашиваем доступ к камере
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      console.log("✅ Камера получена:", stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log("✅ Видео запущено");
      }

      // Ждём, пока видео загрузится
      await new Promise<void>((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            console.log("✅ Видео метаданные загружены");
            resolve();
          };
        }
      });

      console.log("🔌 Подключаемся к WebSocket:", wsUrl);

      // Подключаемся к WebSocket
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        setIsStreaming(true);
        processFrames();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("📦 Получен ответ от сервера:", data);
        drawBboxOnCanvas(data);
      };

      ws.onerror = (err) => {
        console.error("❌ WebSocket error:", err);
        setError("Ошибка подключения к серверу");
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket closed");
        setIsStreaming(false);
      };
    } catch (err: any) {
      console.error("❌ Ошибка запуска камеры:", err);
      setError(err?.message || "Не удалось получить доступ к камере");
    }
  }

  // Остановка стрима
  function stopStream() {
    console.log("⏹️ Останавливаем стрим");

    // Останавливаем камеру
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => {
        track.stop();
        console.log("🛑 Трек остановлен:", track.kind);
      });
      videoRef.current.srcObject = null;
    }

    // Закрываем WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsStreaming(false);
  }

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "system-ui",
      }}
    >
      <h1>🎥 Стрим с камеры - Ship Detection</h1>
      <p style={{ color: "#666" }}>
        Детекция кораблей в реальном времени через веб-камеру. WebSocket:{" "}
        <code>{wsUrl}</code>
      </p>

      <nav style={{ margin: "20px 0", display: "flex", gap: 16 }}>
        <Link href="/" style={{ textDecoration: "none", color: "#0070f3" }}>
          Главная
        </Link>
        <Link
          href="/stream"
          style={{
            textDecoration: "none",
            color: "#0070f3",
            fontWeight: "bold",
          }}
        >
          Стрим с камеры
        </Link>
        <Link
          href="/history"
          style={{ textDecoration: "none", color: "#0070f3" }}
        >
          История
        </Link>
      </nav>

      <hr />

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        {!isStreaming ? (
          <button
            onClick={startStream}
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            🎥 Запустить камеру
          </button>
        ) : (
          <button
            onClick={stopStream}
            style={{
              padding: "10px 20px",
              background: "#f44",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            ⏹️ Остановить
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: "#fee",
            border: "1px solid #f99",
            borderRadius: 4,
          }}
        >
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {isStreaming && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#e8f5e9",
            border: "1px solid #4caf50",
            borderRadius: 4,
          }}
        >
          <strong>🟢 Стрим активен</strong> | FPS: {stats.fps} | Кораблей:{" "}
          {stats.ships}
        </div>
      )}

      {/* Скрытое видео (источник камеры) */}
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />

      {/* Canvas с детекцией */}
      <div style={{ marginTop: 24 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            maxWidth: 640,
            border: "2px solid #0070f3",
            borderRadius: 4,
            background: "#000",
          }}
        />
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f6f6f6",
          borderRadius: 4,
        }}
      ></div>
    </main>
  );
}
