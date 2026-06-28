"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PopularScene, StatsOverview } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { LoginCard } from "@/components/LoginCard";

export default function DashboardPage() {
  const { token, ready } = useAuth();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [scenes, setScenes] = useState<PopularScene[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.statsOverview(), api.popularScenes()])
      .then(([s, p]) => {
        setStats(s);
        setScenes(p);
      })
      .catch((e) => setErr(e.message));
  }, [token]);

  // RBAC gate: dashboard requires authentication (executive/admin)
  if (!ready) return null;
  if (!token)
    return (
      <LoginCard note="Executive Dashboard ต้องเข้าสู่ระบบ (executive หรือ admin)" />
    );

  const kpis = stats
    ? [
        { label: "จำนวน Session", value: stats.sessions_total, icon: "fa-users" },
        { label: "ภาพที่สร้าง", value: stats.images_total, icon: "fa-images" },
        {
          label: "ดาวน์โหลด/แชร์",
          value: stats.downloads_total,
          icon: "fa-download",
        },
        {
          label: "ความพึงพอใจ",
          value: `${stats.avg_rating}/5`,
          icon: "fa-star",
        },
      ]
    : [];

  const maxCount = Math.max(1, ...scenes.map((s) => s.count));

  return (
    <div className="fadein">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-psru-greenDark">
            Executive Dashboard
          </h1>
          <p className="text-psru-muted text-sm">
            ภาพรวมการใช้งานระบบ (ข้อมูลจริงจาก Core API)
          </p>
        </div>
      </div>

      {err && (
        <div className="glass rounded-2xl p-4 text-amber-700 text-sm mb-5">
          <i className="fa-solid fa-triangle-exclamation mr-2" />
          เชื่อมต่อ API ไม่ได้ ({err}) — โปรดรัน backend ที่ {""}
          <code>http://localhost:8000</code>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="glass rounded-3xl p-5 shadow-xl">
            <div className="w-10 h-10 rounded-xl gradient-green text-white flex items-center justify-center">
              <i className={`fa-solid ${k.icon}`} />
            </div>
            <div className="text-2xl font-extrabold text-psru-greenDark mt-3">
              {k.value}
            </div>
            <div className="text-xs text-psru-muted">{k.label}</div>
          </div>
        ))}
        {!stats && !err && (
          <div className="col-span-full text-center text-psru-muted py-8">
            กำลังโหลด…
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-5 shadow-xl">
        <h3 className="font-bold text-psru-greenDark mb-3">
          ฉากยอดนิยม (ตามจำนวนภาพที่สร้างสำเร็จ)
        </h3>
        {scenes.length === 0 ? (
          <p className="text-sm text-psru-muted">
            ยังไม่มีข้อมูล — ลองสร้างภาพจากหน้า Kiosk ก่อน
          </p>
        ) : (
          <div className="space-y-3">
            {scenes.map((s) => (
              <div key={s.scene_id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-psru-ink font-mono">
                    {s.scene_id.slice(0, 8)}…
                  </span>
                  <span className="text-psru-muted">{s.count}</span>
                </div>
                <div className="h-2 bg-psru-mint rounded-full">
                  <div
                    className="h-2 gradient-green rounded-full"
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats && (
        <p className="text-xs text-psru-muted mt-4">
          เวลาเรนเดอร์เฉลี่ย: {stats.avg_render_ms} ms
        </p>
      )}
    </div>
  );
}
