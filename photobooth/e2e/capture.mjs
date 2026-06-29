// Capture screenshots of every screen against the live stack.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const FE = "http://localhost:3000";
const STATIC = "http://localhost:5500/index.html";
const CHROME = "/opt/pw-browsers/chromium";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  permissions: ["camera"],
});
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const hydrate = () =>
  page.waitForFunction(() => !document.body.innerText.includes("กำลังตรวจสอบ API"), { timeout: 12000 }).catch(() => {});

// ---------- Next.js production app ----------
await page.goto(FE, { waitUntil: "networkidle" });
await hydrate();
await shot("01-landing");

await page.goto(`${FE}/kiosk`, { waitUntil: "networkidle" });
await hydrate();
await shot("02-kiosk-consent");
await page.locator('input[type="checkbox"]').first().check();
await page.locator("button:has-text('ยอมรับและเริ่มต้น'):not([disabled])").waitFor();
await page.getByRole("button", { name: /ยอมรับและเริ่มต้น/ }).click();
await page.getByRole("button", { name: /ถ่ายภาพ/ }).waitFor();
await shot("03-kiosk-capture");
await page.getByRole("button", { name: /ถ่ายภาพ/ }).click();
await page.getByText("เลือกฉากเสมือน").waitFor();
await shot("04-kiosk-scenes");
await page.locator(".lg\\:col-span-2 button").nth(2).click();
await page.getByRole("button", { name: /สร้างภาพด้วย AI/ }).click();
await page.locator('img[alt="ภาพผลลัพธ์"]').waitFor({ state: "visible", timeout: 30000 });
await page.waitForTimeout(500);
await shot("05-kiosk-result");

await page.goto(`${FE}/dashboard`, { waitUntil: "networkidle" });
await hydrate();
await shot("06-dashboard-login");
await page.getByRole("button", { name: /Executive/ }).click();
await page.getByText("ภาพที่สร้าง", { exact: true }).waitFor({ timeout: 8000 });
await page.waitForTimeout(400);
await shot("07-dashboard");

// ---------- index.html (VR + Admin views) ----------
await page.goto(STATIC, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: /VR/ }).first().click();
await page.waitForTimeout(400);
await shot("08-vr");
await page.getByRole("button", { name: /Admin/ }).first().click();
await page.waitForTimeout(400);
await shot("09-admin");

await browser.close();
console.log("captured screenshots to", OUT);
