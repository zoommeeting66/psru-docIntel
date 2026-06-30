// Generates an equirectangular (2:1) panorama on a canvas, used as the texture
// for the 360° sphere. Procedural so the VR viewer needs no external image asset
// (Phase 2 swaps this for real HDRI/360 captures from the VR Scene Library).

export interface VrEnv {
  name: string;
  sky: [string, string]; // top → horizon
  ground: [string, string]; // horizon → bottom
  accent: string;
}

export const VR_ENVS: VrEnv[] = [
  { name: "หอประชุมศรีวชิรโชติ", sky: ["#0E7A4B", "#9fd9bf"], ground: ["#0A5D39", "#063D26"], accent: "#C9A227" },
  { name: "พิธีพระราชทานปริญญาบัตร", sky: ["#1b3a2c", "#C9A227"], ground: ["#0A5D39", "#042017"], accent: "#FFFFFF" },
  { name: "ห้องสมุดดิจิทัล", sky: ["#0b3b5a", "#7fc7e8"], ground: ["#0a2a3f", "#04151f"], accent: "#C9A227" },
  { name: "เมืองอนาคต", sky: ["#10204a", "#6f8cff"], ground: ["#0a1230", "#05060f"], accent: "#39e0ff" },
  { name: "ธรรมชาติ (พระอาทิตย์ตก)", sky: ["#2a3a6a", "#ff9d5c"], ground: ["#243d2a", "#0e1a12"], accent: "#ffd27f" },
  { name: "อวกาศ", sky: ["#05060f", "#1a1f3a"], ground: ["#05060f", "#000000"], accent: "#C9A227" },
];

export function makePanorama(env: VrEnv): HTMLCanvasElement {
  const W = 2048;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const horizon = H * 0.5;

  // sky gradient
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, env.sky[0]);
  sky.addColorStop(1, env.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);

  // ground gradient
  const ground = g.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, env.ground[0]);
  ground.addColorStop(1, env.ground[1]);
  g.fillStyle = ground;
  g.fillRect(0, horizon, W, H - horizon);

  // stars for space / dark skies
  if (env.name === "อวกาศ") {
    g.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * W;
      const y = Math.random() * horizon;
      g.fillRect(x, y, Math.random() < 0.1 ? 2 : 1, Math.random() < 0.1 ? 2 : 1);
    }
  }

  // horizon line
  g.strokeStyle = env.accent;
  g.globalAlpha = 0.5;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, horizon);
  g.lineTo(W, horizon);
  g.stroke();
  g.globalAlpha = 1;

  // perspective "pillars" / grid every 30° to give a sense of an enclosed venue
  g.strokeStyle = env.accent;
  g.globalAlpha = 0.18;
  g.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * W;
    g.beginPath();
    g.moveTo(x, horizon - 220);
    g.lineTo(x, H);
    g.stroke();
  }
  // floor depth lines
  for (let r = 1; r <= 6; r++) {
    const y = horizon + (r / 6) * (H - horizon);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.globalAlpha = 1;

  // brand labels around the ring
  g.fillStyle = env.accent;
  g.font = "bold 44px sans-serif";
  g.textAlign = "center";
  for (let i = 0; i < 4; i++) {
    const x = (i / 4) * W + W / 8;
    g.fillText("PSRU", x, horizon - 70);
    g.font = "28px sans-serif";
    g.fillText(env.name, x, horizon - 28);
    g.font = "bold 44px sans-serif";
  }
  return c;
}
