"use client";
import { useState } from "react";
import type { Consent } from "@/lib/types";

export function ConsentStep({
  onAccept,
  busy,
}: {
  onAccept: (c: Consent) => void;
  busy: boolean;
}) {
  const [biometric, setBiometric] = useState(false);
  const [ageGender, setAgeGender] = useState(false);
  const [marketing, setMarketing] = useState(false);

  return (
    <div className="max-w-2xl mx-auto fadein">
      <div className="glass rounded-3xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-green mx-auto flex items-center justify-center text-white text-2xl mb-3">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <h2 className="text-2xl font-extrabold text-psru-greenDark">
            ความยินยอม (PDPA)
          </h2>
          <p className="text-psru-muted text-sm mt-1">
            เพื่อสร้างภาพระดับสตูดิโอ ระบบจำเป็นต้องประมวลผลภาพของท่านชั่วคราว
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={biometric}
              onChange={(e) => setBiometric(e.target.checked)}
              className="mt-1 accent-psru-green w-4 h-4"
            />
            <span>
              <b>วิเคราะห์ภาพ/ใบหน้า-ท่าทาง</b> เพื่อจัดองค์ประกอบและแสง (จำเป็น)
            </span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={ageGender}
              onChange={(e) => setAgeGender(e.target.checked)}
              className="mt-1 accent-psru-green w-4 h-4"
            />
            <span>วิเคราะห์อายุ/เพศโดยประมาณ เพื่อแนะนำฉาก/ชุด (ไม่บังคับ)</span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-1 accent-psru-green w-4 h-4"
            />
            <span>อนุญาตให้ PSRU ใช้ภาพในสื่อประชาสัมพันธ์ (ไม่บังคับ)</span>
          </label>
        </div>

        <p className="text-[11px] text-psru-muted mt-4">
          <i className="fa-solid fa-circle-info" /> ภาพต้นฉบับจะถูกลบอัตโนมัติภายใน
          24 ชม. · ทุกภาพมีลายน้ำ &quot;AI-generated&quot; · นโยบาย v2026.1
        </p>
        <button
          disabled={!biometric || busy}
          onClick={() =>
            onAccept({
              biometric_ok: biometric,
              age_gender_ok: ageGender,
              marketing_ok: marketing,
              policy_version: "2026.1",
            })
          }
          className="mt-6 w-full gradient-green text-white font-bold py-3.5 rounded-xl shadow-lg hover:opacity-95 disabled:opacity-40"
        >
          {busy ? "กำลังเริ่ม…" : "ยอมรับและเริ่มต้น"}{" "}
          <i className="fa-solid fa-arrow-right ml-1" />
        </button>
      </div>
    </div>
  );
}
