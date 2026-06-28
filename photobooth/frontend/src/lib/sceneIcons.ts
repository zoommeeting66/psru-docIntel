// Map known scene names → Font Awesome icon classes (falls back to a generic icon).
const ICONS: Record<string, string> = {
  "หอประชุมศรีวชิรโชติ": "fa-building-columns",
  "อาคารเรียน PSRU": "fa-school",
  "พิธีพระราชทานปริญญาบัตร": "fa-graduation-cap",
  "ห้องรับรอง VIP": "fa-couch",
  "ห้องประชุมผู้บริหาร": "fa-users-rectangle",
  "ห้องเรียนอัจฉริยะ": "fa-chalkboard",
  "ห้องสมุดดิจิทัล": "fa-book",
  "เวทีประชุมวิชาการ": "fa-microphone-lines",
  "สตูดิโอข่าว": "fa-tv",
  "เมืองอนาคต": "fa-city",
  "อวกาศ": "fa-rocket",
  "ธรรมชาติ": "fa-tree",
  "พิพิธภัณฑ์": "fa-landmark",
  "วัดไทย": "fa-place-of-worship",
  "เมืองโบราณ": "fa-archway",
  "พระราชวัง (เชิงสัญลักษณ์)": "fa-chess-rook",
};

export function sceneIcon(name: string): string {
  return ICONS[name] ?? "fa-image";
}
