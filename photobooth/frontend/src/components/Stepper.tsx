const STEPS = ["ยินยอม", "ถ่ายภาพ", "เลือกฉาก/ชุด", "AI สร้างภาพ", "ผลลัพธ์"];

export function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 text-xs sm:text-sm">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n <= current;
        return (
          <div key={label} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition ${
                  active
                    ? "bg-psru-green text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {n}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {n < STEPS.length && (
              <i className="fa-solid fa-chevron-right text-slate-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}
