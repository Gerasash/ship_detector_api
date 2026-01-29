"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Ship = {
  class: string;
  conf: number;
  bbox: [number, number, number, number];
};

type ApiResult = {
  success: boolean;
  processing_time: number;
  results: {
    total_ships: number;
    has_ships: boolean;
    ships?: Ship[];
    // для видео:
    total_frames_processed?: number;
    frames_with_ships?: number;
    max_ships_per_frame?: number;
    avg_ships_per_frame?: number;
    total_ships_detected?: number;
  };
};

export default function Home() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);

    // Создаём URL для превью (работает и для фото, и для видео)
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleSubmit() {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const endpoint = mode === "image" ? "/detect/image" : "/detect/video";
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || "API error");

      setResult(json);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!result || !result.results.ships || mode !== "image" || !preview)
      return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = preview;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      result.results.ships!.forEach((ship) => {
        const [x1, y1, x2, y2] = ship.bbox;
        const w = x2 - x1;
        const h = y2 - y1;

        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, w, h);

        const label = `${ship.class} ${(ship.conf * 100).toFixed(0)}%`;
        ctx.font = "bold 18px Arial";
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
        ctx.fillRect(x1, y1 > 25 ? y1 - 25 : y1, textWidth + 10, 25);

        ctx.fillStyle = "#000";
        ctx.fillText(label, x1 + 5, y1 > 25 ? y1 - 7 : y1 + 18);
      });
    };

    if (img.complete) {
      img.onload(null as any);
    }
  }, [result, preview, mode]);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "system-ui",
      }}
    >
      <h1>🛳️ Ship Detection - Port Monitoring</h1>
      <p style={{ color: "#666" }}>
        Загрузите фото или видео порта для детекции кораблей. API:{" "}
        <code>{apiBase}</code>
      </p>

      <nav style={{ margin: "20px 0", display: "flex", gap: 16 }}>
        <Link href="/" style={{ textDecoration: "none", color: "#0070f3" }}>
          Главная
        </Link>
        <Link
          href="/stream"
          style={{ textDecoration: "none", color: "#0070f3" }}
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

      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label>
          Режим:{" "}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            style={{ padding: 6 }}
          >
            <option value="image">Фото</option>
            <option value="video">Видео</option>
          </select>
        </label>

        <input
          type="file"
          accept={mode === "image" ? "image/*" : "video/*"}
          onChange={handleFileChange}
          style={{ padding: 6 }}
        />

        <button
          onClick={handleSubmit}
          disabled={!file || loading}
          style={{
            padding: "8px 16px",
            background: loading ? "#ccc" : "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Обработка..." : "Запустить детекцию"}
        </button>
      </div>

      {/* Превью для фото */}
      {preview && mode === "image" && !result && (
        <div style={{ marginTop: 24 }}>
          <h3>Превью:</h3>
          <img
            src={preview}
            alt="preview"
            style={{
              maxWidth: "100%",
              maxHeight: 400,
              border: "1px solid #ddd",
              borderRadius: 4,
            }}
          />
        </div>
      )}

      {/* Превью для видео */}
      {preview && mode === "video" && (
        <div style={{ marginTop: 24 }}>
          <h3>Превью видео:</h3>
          <video
            src={preview}
            controls
            style={{
              maxWidth: "100%",
              maxHeight: 400,
              border: "1px solid #ddd",
              borderRadius: 4,
            }}
          />
        </div>
      )}

      {/* Canvas с боксами (только для фото после обработки) */}
      {result && mode === "image" && result.results.ships && (
        <div style={{ marginTop: 24 }}>
          <h3>Детекция:</h3>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: "100%",
              border: "2px solid #0070f3",
              borderRadius: 4,
            }}
          />
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#fee",
            border: "1px solid #f99",
            borderRadius: 4,
          }}
        >
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#f0f9ff",
            border: "1px solid #0070f3",
            borderRadius: 4,
          }}
        >
          <h2>✅ Результат</h2>
          <p>
            <strong>Время обработки:</strong> {result.processing_time}s
          </p>

          {mode === "image" && (
            <>
              <p>
                <strong>Кораблей обнаружено:</strong>{" "}
                {result.results.total_ships}
              </p>
              {result.results.ships && result.results.ships.length > 0 && (
                <details>
                  <summary>
                    Детали ({result.results.ships.length} объектов)
                  </summary>
                  <ul>
                    {result.results.ships.map((ship, i) => (
                      <li key={i}>
                        {ship.class} (уверенность:{" "}
                        {(ship.conf * 100).toFixed(1)}%)
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}

          {mode === "video" && (
            <>
              <p>
                <strong>Обработано кадров:</strong>{" "}
                {result.results.total_frames_processed}
              </p>
              <p>
                <strong>Кадров с кораблями:</strong>{" "}
                {result.results.frames_with_ships}
              </p>
              <p>
                <strong>Максимум кораблей в одном кадре:</strong>{" "}
                {result.results.max_ships_per_frame}
              </p>
              <p>
                <strong>Всего детекций:</strong>{" "}
                {result.results.total_ships_detected}
              </p>
            </>
          )}

          <details style={{ marginTop: 12 }}>
            <summary>JSON (полный)</summary>
            <pre
              style={{
                background: "#fff",
                padding: 12,
                border: "1px solid #ddd",
                overflowX: "auto",
                fontSize: 12,
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </main>
  );
}
