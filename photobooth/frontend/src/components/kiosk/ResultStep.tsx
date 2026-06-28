"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Output } from "@/lib/types";

export function ResultStep({
  output,
  sceneName,
  onReset,
}: {
  output: Output;
  sceneName: string;
  onReset: () => void;
}) {
  const [rating, setRating] = useState(0);

  async function rate(n: number) {
    setRating(n);
    try {
      await api.feedback(output.id, n);
    } catch {
      /* non-blocking */
    }
  }

  async function share() {
    try {
      const s = await api.shareOutput(output.id);
      window.prompt("ลิงก์แชร์ (มีอายุ):", s.share_url);
    } catch {
      alert("แชร์ไม่สำเร็จ");
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5 fadein">
      <div className="lg:col-span-2 glass rounded-3xl p-5 shadow-xl">
        <div className="relative rounded-2xl overflow-hidden gradient-green aspect-[4/3] flex items-center justify-center">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 text-white text-xs">
            <div className="w-7 h-7 rounded-lg gradient-gold flex items-center justify-center text-psru-greenDeep font-extrabold">
              P
            </div>
            <span>{sceneName}</span>
          </div>
          {output.final_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={output.final_url}
              alt="ภาพผลลัพธ์"
              className="absolute inset-0 w-full h-full object-contain bg-psru-greenDeep"
            />
          ) : (
            <div className="text-white text-center z-10">
              <i className="fa-solid fa-image text-7xl mb-2 opacity-80" />
              <div className="text-sm">ไม่มีภาพผลลัพธ์</div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass rounded-3xl p-5 shadow-xl text-center">
          <div className="w-28 h-28 mx-auto rounded-xl bg-white border-2 border-psru-mint flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={api.qrUrl(output.id)}
              alt="QR"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-sm text-psru-muted mt-2">
            สแกนเพื่อดาวน์โหลด · ภาพหมายเลข {output.image_no ?? "—"}
          </p>
        </div>

        <div className="glass rounded-3xl p-4 shadow-xl grid grid-cols-3 gap-2 text-center text-[11px] text-psru-greenDark">
          <a
            href={api.downloadUrl(output.id, "png")}
            target="_blank"
            rel="noreferrer"
            className="py-2 rounded-xl bg-psru-mint"
          >
            <i className="fa-solid fa-file-image block text-lg mb-1" />
            PNG
          </a>
          <a
            href={api.downloadUrl(output.id, "pdf")}
            target="_blank"
            rel="noreferrer"
            className="py-2 rounded-xl bg-psru-mint"
          >
            <i className="fa-solid fa-file-pdf block text-lg mb-1" />
            PDF
          </a>
          <button onClick={share} className="py-2 rounded-xl bg-psru-mint">
            <i className="fa-solid fa-share-nodes block text-lg mb-1" />
            แชร์
          </button>
        </div>

        <div className="glass rounded-3xl p-4 shadow-xl">
          <p className="text-sm font-semibold text-psru-greenDark mb-2">
            ให้คะแนนความพึงพอใจ
          </p>
          <div className="flex gap-1 text-2xl text-psru-gold">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => rate(n)}>
                <i className={`${n <= rating ? "fa-solid" : "fa-regular"} fa-star`} />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onReset}
          className="w-full bg-white text-psru-greenDark font-bold py-3 rounded-xl shadow"
        >
          <i className="fa-solid fa-rotate-left mr-1" /> เริ่มใหม่
        </button>
      </div>
    </div>
  );
}
