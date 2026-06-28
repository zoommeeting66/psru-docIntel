"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function ApiBadge() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then(() => alive && setOk(true))
      .catch(() => alive && setOk(false));
    return () => {
      alive = false;
    };
  }, []);

  const dot =
    ok === null ? "bg-slate-300" : ok ? "bg-green-300 animate-pulse" : "bg-amber-300";
  const label =
    ok === null
      ? "กำลังตรวจสอบ API…"
      : ok
        ? "API: เชื่อมต่อแล้ว"
        : "API: ออฟไลน์";

  return (
    <span className="hidden sm:flex items-center gap-1 text-[11px] bg-white/10 px-2 py-1 rounded-full">
      <span className={`w-2 h-2 rounded-full ${dot}`} /> {label}
    </span>
  );
}
