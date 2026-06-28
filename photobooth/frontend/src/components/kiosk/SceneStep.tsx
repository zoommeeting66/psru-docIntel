"use client";
import { useState } from "react";
import { FX_OPTIONS } from "@/lib/pipeline";
import { sceneIcon } from "@/lib/sceneIcons";
import type { Outfit, Scene } from "@/lib/types";

export function SceneStep({
  scenes,
  outfits,
  onRender,
}: {
  scenes: Scene[];
  outfits: Outfit[];
  onRender: (sceneId: string, outfitId: string | null, fx: Record<string, boolean>) => void;
}) {
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
  const [outfitId, setOutfitId] = useState<string | null>(outfits[0]?.id ?? null);
  const [fx, setFx] = useState<Set<string>>(new Set());

  function toggleFx(k: string) {
    setFx((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5 fadein">
      <div className="lg:col-span-2 glass rounded-3xl p-5 shadow-xl">
        <h2 className="text-lg font-extrabold text-psru-greenDark mb-3">
          เลือกฉากเสมือน
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {scenes.map((s) => (
            <button
              key={s.id}
              onClick={() => setSceneId(s.id)}
              className={`rounded-2xl overflow-hidden text-left shadow hover:shadow-lg transition ${
                s.id === sceneId ? "outline outline-[3px] outline-psru-gold" : ""
              }`}
            >
              <div className="gradient-green h-24 flex items-center justify-center text-white text-3xl">
                <i className={`fa-solid ${sceneIcon(s.name)}`} />
              </div>
              <div className="p-2 bg-white">
                <div className="text-xs font-semibold text-psru-ink leading-tight">
                  {s.name}
                </div>
                <div className="text-[10px] text-psru-muted">
                  {s.category}
                  {s.is_360 && <span className="text-psru-gold"> · VR</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className="glass rounded-3xl p-5 shadow-xl">
          <h3 className="font-bold text-psru-greenDark mb-2">
            <i className="fa-solid fa-shirt text-psru-gold mr-1" /> เครื่องแต่งกาย
          </h3>
          <div className="flex flex-wrap gap-2">
            {outfits.map((o) => (
              <button
                key={o.id}
                onClick={() => setOutfitId(o.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  o.id === outfitId
                    ? "gradient-green text-white"
                    : "bg-white text-psru-muted"
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-5 shadow-xl">
          <h3 className="font-bold text-psru-greenDark mb-2">
            <i className="fa-solid fa-wand-magic-sparkles text-psru-gold mr-1" />{" "}
            เอฟเฟกต์ (Generative)
          </h3>
          <div className="flex flex-wrap gap-2">
            {FX_OPTIONS.map((f) => (
              <button
                key={f.key}
                onClick={() => toggleFx(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  fx.has(f.key)
                    ? "gradient-gold text-white"
                    : "bg-white text-psru-muted"
                }`}
              >
                <i className={`fa-solid ${f.icon} mr-1`} />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!sceneId}
          onClick={() =>
            onRender(
              sceneId,
              outfitId,
              Object.fromEntries([...fx].map((k) => [k, true])),
            )
          }
          className="w-full gradient-green text-white font-extrabold py-4 rounded-2xl shadow-lg text-lg disabled:opacity-40"
        >
          <i className="fa-solid fa-wand-magic-sparkles mr-2" /> สร้างภาพด้วย AI
        </button>
      </div>
    </div>
  );
}
