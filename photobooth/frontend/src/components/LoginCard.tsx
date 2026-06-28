"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const ROLES = [
  { key: "executive", label: "Executive — ผู้บริหาร", icon: "fa-chart-line" },
  { key: "admin", label: "Admin — ผู้ดูแลระบบ", icon: "fa-user-shield" },
  { key: "operator", label: "Operator — เจ้าหน้าที่บูธ", icon: "fa-user-gear" },
];

export function LoginCard({ note }: { note?: string }) {
  const { login } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pick(role: string) {
    setBusy(role);
    setErr(null);
    try {
      await login(role);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-md mx-auto glass rounded-3xl p-8 shadow-xl fadein">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl gradient-green mx-auto flex items-center justify-center text-white text-xl mb-3">
          <i className="fa-solid fa-right-to-bracket" />
        </div>
        <h2 className="text-xl font-extrabold text-psru-greenDark">เข้าสู่ระบบ</h2>
        <p className="text-psru-muted text-sm mt-1">
          {note ?? "ส่วนนี้ต้องยืนยันตัวตน (RBAC)"}
        </p>
      </div>
      <div className="space-y-2">
        {ROLES.map((r) => (
          <button
            key={r.key}
            onClick={() => pick(r.key)}
            disabled={!!busy}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/70 hover:bg-psru-mint text-left disabled:opacity-50"
          >
            <span className="w-9 h-9 rounded-lg gradient-green text-white flex items-center justify-center">
              <i className={`fa-solid ${r.icon}`} />
            </span>
            <span className="font-semibold text-psru-ink text-sm">{r.label}</span>
            {busy === r.key && (
              <i className="fa-solid fa-spinner fa-spin ml-auto text-psru-green" />
            )}
          </button>
        ))}
      </div>
      {err && <p className="text-amber-700 text-xs mt-3">{err}</p>}
      <p className="text-[11px] text-psru-muted mt-4">
        <i className="fa-solid fa-circle-info" /> โหมดสาธิตใช้ dev-token; production
        ใช้ Keycloak (OIDC + MFA)
      </p>
    </div>
  );
}
