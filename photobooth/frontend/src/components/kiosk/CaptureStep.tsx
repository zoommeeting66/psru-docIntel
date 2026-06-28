"use client";
import { useEffect, useRef, useState } from "react";

export function CaptureStep({
  onCapture,
  busy,
}: {
  onCapture: (blob: Blob) => void;
  busy: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);

  useEffect(() => {
    let alive = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamOn(true);
      })
      .catch(() => setCamOn(false));
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const c = canvasRef.current!;
    const v = videoRef.current;
    let w = 1280;
    let h = 960;
    const g = c.getContext("2d")!;
    if (camOn && v && v.videoWidth) {
      w = v.videoWidth;
      h = v.videoHeight;
      c.width = w;
      c.height = h;
      g.drawImage(v, 0, 0, w, h);
    } else {
      c.width = w;
      c.height = h;
      g.fillStyle = "#063D26";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#C9A227";
      g.font = "bold 56px sans-serif";
      g.textAlign = "center";
      g.fillText("PSRU (mock capture)", w / 2, h / 2);
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.9);
  }

  return (
    <div className="max-w-2xl mx-auto fadein">
      <div className="glass rounded-3xl p-6 shadow-xl">
        <h2 className="text-xl font-extrabold text-psru-greenDark mb-1 text-center">
          ยืนหน้ากล้อง แล้วกดถ่าย
        </h2>
        <p className="text-psru-muted text-sm text-center mb-4">
          รองรับ Webcam · DSLR · Mirrorless · Mobile · Kiosk
        </p>
        <div className="relative rounded-2xl overflow-hidden bg-psru-greenDeep aspect-[4/3] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${camOn ? "" : "hidden"}`}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!camOn && (
            <div className="text-white/70 text-center z-10">
              <i className="fa-solid fa-user-large text-7xl mb-2" />
              <div className="text-xs">
                เปิดกล้องไม่ได้ — จะใช้ภาพจำลองแทน
              </div>
            </div>
          )}
          <div className="absolute top-3 left-3 text-[11px] bg-black/40 text-white px-2 py-1 rounded-full">
            <i className="fa-solid fa-circle text-red-400 text-[8px] mr-1" /> REC
          </div>
          <div className="absolute bottom-3 right-3 text-[11px] bg-black/40 text-white px-2 py-1 rounded-full">
            AI แนะนำท่า: ยืนตรง ยิ้มเล็กน้อย
          </div>
        </div>
        <button
          onClick={capture}
          disabled={busy}
          className="mt-4 w-full gradient-gold text-white font-extrabold py-4 rounded-2xl shadow-lg text-lg disabled:opacity-50"
        >
          <i className="fa-solid fa-camera mr-2" />{" "}
          {busy ? "กำลังอัปโหลด…" : "ถ่ายภาพ"}
        </button>
      </div>
    </div>
  );
}
