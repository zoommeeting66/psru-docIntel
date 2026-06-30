import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const FE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${FE}/vr`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const hasCanvas = await page.locator("canvas").count();
const fallback = await page.getByText("ไม่รองรับ WebGL").isVisible().catch(() => false);
await page.screenshot({ path: `${OUT}vr.png` });
// switch environment
await page.getByRole("button", { name: /เมืองอนาคต/ }).click().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}vr-2.png` });
await browser.close();
console.log(JSON.stringify({ hasCanvas, fallback, errors: errors.slice(0, 5) }, null, 2));
