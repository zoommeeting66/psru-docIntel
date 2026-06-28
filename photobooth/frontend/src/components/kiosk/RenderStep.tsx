"use client";
import { PIPELINE } from "@/lib/pipeline";
import type { Job } from "@/lib/types";

export function RenderStep({ job }: { job: Job | null }) {
  const steps = job?.pipeline_steps ?? {};
  const progress = job?.progress ?? 0;

  return (
    <div className="max-w-xl mx-auto fadein">
      <div className="glass-dark gradient-green rounded-3xl p-8 shadow-xl text-white text-center">
        <div className="spinner mx-auto mb-5" />
        <h2 className="text-xl font-extrabold mb-1">
          AI กำลังสร้างภาพระดับสตูดิโอ…
        </h2>
        <p className="text-psru-goldSoft text-sm mb-5">
          {job?.stage ? `${job.stage} · ${progress}%` : "กำลังเริ่มต้น…"}
        </p>
        <div className="w-full bg-white/15 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 gradient-gold transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-6 text-left text-xs">
          {PIPELINE.map((p) => {
            const st = steps[p.key]?.status;
            if (st === "done")
              return (
                <div key={p.key} className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-psru-goldSoft" />{" "}
                  {p.label}
                </div>
              );
            if (st === "skipped")
              return (
                <div key={p.key} className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-minus text-white/50" /> {p.label}{" "}
                  <span className="text-[10px]">(ข้าม)</span>
                </div>
              );
            return (
              <div key={p.key} className="flex items-center gap-2 opacity-40">
                <i className="fa-regular fa-circle" /> {p.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
