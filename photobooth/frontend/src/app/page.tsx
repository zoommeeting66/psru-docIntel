import Link from "next/link";

const cards = [
  {
    href: "/kiosk",
    icon: "fa-camera-retro",
    title: "เริ่มถ่ายภาพ (Kiosk)",
    desc: "ยืนหน้ากล้อง เลือกฉาก/ชุด แล้วให้ AI สร้างภาพระดับสตูดิโอภายในไม่กี่วินาที",
  },
  {
    href: "/dashboard",
    icon: "fa-chart-line",
    title: "Executive Dashboard",
    desc: "ภาพรวมการใช้งาน จำนวนภาพ ฉากยอดนิยม ความพึงพอใจ และตัวชี้วัด",
  },
];

export default function Home() {
  return (
    <div className="fadein">
      <section className="glass rounded-3xl p-8 sm:p-12 shadow-xl mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl gradient-green mx-auto flex items-center justify-center text-white text-2xl mb-4">
          <i className="fa-solid fa-wand-magic-sparkles" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-psru-greenDark">
          PSRU AI Virtual Photo Booth &amp; VR Studio
        </h1>
        <p className="text-psru-muted mt-3 max-w-2xl mx-auto">
          เพียงยืนหน้ากล้อง AI จะสร้างภาพระดับสตูดิโอในโลกเสมือนภายในไม่กี่วินาที
          โดยไม่ต้องใช้ Green Screen
        </p>
      </section>

      <div className="grid sm:grid-cols-2 gap-5">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="glass rounded-3xl p-6 shadow-xl hover:shadow-2xl transition group"
          >
            <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center text-psru-greenDeep text-xl mb-4">
              <i className={`fa-solid ${c.icon}`} />
            </div>
            <h2 className="text-xl font-extrabold text-psru-greenDark group-hover:text-psru-green">
              {c.title}
            </h2>
            <p className="text-sm text-psru-muted mt-1">{c.desc}</p>
            <span className="inline-flex items-center gap-1 text-psru-green text-sm font-semibold mt-4">
              เปิด <i className="fa-solid fa-arrow-right" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
