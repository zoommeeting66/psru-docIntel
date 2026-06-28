"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function AuthControls() {
  const { role, logout, ready } = useAuth();
  if (!ready) return null;

  if (!role) {
    return (
      <Link
        href="/dashboard"
        className="text-[11px] bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full font-semibold"
      >
        <i className="fa-solid fa-right-to-bracket mr-1" /> เข้าสู่ระบบ
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] bg-white/10 px-2 py-1 rounded-full">
        <i className="fa-solid fa-user-shield mr-1 text-psru-goldSoft" />
        {role}
      </span>
      <button
        onClick={logout}
        title="ออกจากระบบ"
        className="text-[11px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded-full"
      >
        <i className="fa-solid fa-arrow-right-from-bracket" />
      </button>
    </div>
  );
}
