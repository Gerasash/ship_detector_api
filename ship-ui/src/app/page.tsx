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

  // ✅ НОВАЯ ФУНКЦИЯ ЭКСПОРТА
  const exportReport = async (format: "pdf" | "excel") => {
    if (!result) return;

    try {
      const response = await fetch(`${apiBase}/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: result.results }),
      });

      if (!response.ok) throw new Error("Ошибка сервера");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ship_detection_${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Ошибка экспорта: " + err.message);
    }
  };

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);

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

      {/* ✅ ОБНОВЛЕННЫЙ БЛОК РЕЗУЛЬТАТОВ С КНОПКАМИ */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 24,
            background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
            border: "2px solid #0070f3",
            borderRadius: 12,
            boxShadow: "0 10px 25px rgba(0,112,243,0.1)",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: 16,
              color: "#1e40af",
            }}
          >
            ✅ Результат обработки
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                textAlign: "center",
                padding: 20,
                background: "white",
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  fontSize: "36px",
                  fontWeight: "bold",
                  color: "#10b981",
                  marginBottom: 8,
                }}
              >
                {result.results.total_ships}
              </div>
              <div style={{ color: "#6b7280", fontSize: "14px" }}>
                Обнаружено судов
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: 20,
                background: "white",
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  color: "#3b82f6",
                  marginBottom: 8,
                }}
              >
                {result.processing_time.toFixed(2)}s
              </div>
              <div style={{ color: "#6b7280", fontSize: "14px" }}>
                Время обработки
              </div>
            </div>
          </div>

          {/* КНОПКИ ЭКСПОРТА */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 24,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => exportReport("pdf")}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
                transition: "all 0.2s",
              }}
              onMouseOver={(e: any) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 20px rgba(239,68,68,0.4)";
              }}
              onMouseOut={(e: any) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 12px rgba(239,68,68,0.3)";
              }}
            >
              📄 Скачать PDF отчет
            </button>
            <button
              onClick={() => exportReport("excel")}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                transition: "all 0.2s",
              }}
              onMouseOver={(e: any) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 20px rgba(16,185,129,0.4)";
              }}
              onMouseOut={(e: any) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 12px rgba(16,185,129,0.3)";
              }}
            >
              📊 Скачать Excel
            </button>
          </div>

          {/* Детали результата */}
          {mode === "image" && (
            <>
              <p style={{ marginBottom: 16 }}>
                <strong>Кораблей обнаружено:</strong>{" "}
                <span
                  style={{
                    color: "#10b981",
                    fontSize: "20px",
                    fontWeight: "bold",
                  }}
                >
                  {result.results.total_ships}
                </span>
              </p>
              {result.results.ships && result.results.ships.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      padding: 12,
                      background: "#f3f4f6",
                      borderRadius: 8,
                      fontWeight: "bold",
                    }}
                  >
                    Детали ({result.results.ships.length} объектов) ▼
                  </summary>
                  <div
                    style={{
                      marginTop: 12,
                      padding: 16,
                      background: "white",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      {result.results.ships.map((ship, i) => (
                        <li
                          key={i}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          <span style={{ fontWeight: "bold" }}>
                            {ship.class}
                          </span>
                          <span style={{ color: "#3b82f6", marginLeft: 8 }}>
                            {(ship.conf * 100).toFixed(1)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}
            </>
          )}

          {mode === "video" && (
            <div
              style={{
                background: "white",
                padding: 16,
                borderRadius: 8,
                marginTop: 12,
              }}
            >
              <h4 style={{ marginBottom: 12, color: "#374151" }}>
                Статистика видео:
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <strong>Обработано кадров:</strong>{" "}
                  {result.results.total_frames_processed}
                </div>
                <div>
                  <strong>Кадров с кораблями:</strong>{" "}
                  {result.results.frames_with_ships}
                </div>
                <div>
                  <strong>Максимум в кадре:</strong>{" "}
                  {result.results.max_ships_per_frame}
                </div>
                <div>
                  <strong>Всего детекций:</strong>{" "}
                  {result.results.total_ships_detected}
                </div>
              </div>
            </div>
          )}

          <details style={{ marginTop: 16 }}>
            <summary
              style={{
                cursor: "pointer",
                padding: 12,
                background: "#f3f4f6",
                borderRadius: 8,
              }}
            >
              JSON (полный) ▼
            </summary>
            <pre
              style={{
                background: "#f8fafc",
                padding: 16,
                borderRadius: 8,
                overflowX: "auto",
                fontSize: 12,
                marginTop: 12,
                border: "1px solid #e2e8f0",
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
