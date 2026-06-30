import Link from "next/link";
import { ApiBadge } from "./ApiBadge";
import { AuthControls } from "./AuthControls";

const nav = [
  { href: "/kiosk", label: "Kiosk", icon: "fa-camera-retro" },
  { href: "/vr", label: "VR", icon: "fa-vr-cardboard" },
  { href: "/dashboard", label: "Executive", icon: "fa-chart-line" },
];

export function Header() {
  return (
    <header className="gradient-green text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-[1500px] mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-gold flex items-center justify-center text-psru-greenDeep font-extrabold text-xl shadow">
            P
          </div>
          <div>
            <div className="font-extrabold tracking-wide leading-tight">
              PSRU AI Virtual Photo Booth
            </div>
            <div className="text-psru-goldSoft text-[11px] tracking-wide">
              &amp; VR Studio · PSRU Next &amp; New For All
            </div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 rounded-lg hover:bg-white/10 font-semibold"
            >
              <i className={`fa-solid ${n.icon} mr-1`} /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ApiBadge />
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
