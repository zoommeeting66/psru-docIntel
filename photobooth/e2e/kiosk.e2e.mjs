// Playwright E2E — drives the full Kiosk flow in a real browser against the
// live frontend (:3000) + Core API (:8000), then verifies the Executive
// dashboard reflects the created image.
//
// Run:  npm test   (servers must be up; see e2e/README.md)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const FE = process.env.FE_BASE || "http://localhost:3000";
const CHROME = process.env.CHROME_BIN || "/opt/pw-browsers/chromium";
const ART = new URL("./artifacts/", import.meta.url).pathname;
mkdirSync(ART, { recursive: true });

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}`);
  if (!cond) failures++;
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--no-sandbox",
  ],
});
const context = await browser.newContext({ permissions: ["camera"] });
const page = await context.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("    [browser error]", m.text());
});

try {
  // ---------- STEP 1: consent ----------
  console.log("STEP 1 — consent (PDPA)");
  await page.goto(`${FE}/kiosk`, { waitUntil: "networkidle" });
  // wait for React hydration: the ApiBadge useEffect replaces the "checking" text
  await page.waitForFunction(
    () => !document.body.innerText.includes("กำลังตรวจสอบ API"),
    { timeout: 12000 },
  );
  await check(
    "API badge connected",
    await page
      .getByText("API: เชื่อมต่อแล้ว")
      .isVisible()
      .catch(() => false),
  );
  await page.locator('input[type="checkbox"]').first().check();
  const accept = page.getByRole("button", { name: /ยอมรับและเริ่มต้น/ });
  await accept.waitFor({ state: "visible", timeout: 8000 });
  // button is disabled until the (controlled) checkbox state updates post-hydration
  await page
    .locator("button:has-text('ยอมรับและเริ่มต้น'):not([disabled])")
    .waitFor({ timeout: 8000 });
  await accept.click();

  // ---------- STEP 2: capture ----------
  console.log("STEP 2 — capture");
  await page.getByRole("button", { name: /ถ่ายภาพ/ }).waitFor({ timeout: 8000 });
  await check("capture step shown", true);
  await page.getByRole("button", { name: /ถ่ายภาพ/ }).click();

  // ---------- STEP 3: scene picker ----------
  console.log("STEP 3 — choose scene/outfit/fx");
  await page.getByText("เลือกฉากเสมือน").waitFor({ timeout: 10000 });
  const sceneCards = await page.locator("button:has(i.fa-solid)").count();
  await check("scenes loaded from API", sceneCards > 5);
  await page.screenshot({ path: `${ART}03-scenes.png`, fullPage: true });
  // pick the 3rd scene card then render
  await page.locator(".lg\\:col-span-2 button").nth(2).click();
  await page.getByRole("button", { name: /สร้างภาพด้วย AI/ }).click();

  // ---------- STEP 4: rendering ----------
  console.log("STEP 4 — AI render (polling /jobs)");
  await check(
    "render step shown",
    await page
      .getByText("AI กำลังสร้างภาพระดับสตูดิโอ")
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false),
  );

  // ---------- STEP 5: result ----------
  console.log("STEP 5 — result");
  const img = page.locator('img[alt="ภาพผลลัพธ์"]');
  await img.waitFor({ state: "visible", timeout: 30000 });
  const src = await img.getAttribute("src");
  check("result image served by API", !!src && src.includes("/files/"));
  const loaded = await img.evaluate(
    (el) => el.complete && el.naturalWidth > 0,
  );
  check("result image actually rendered (naturalWidth>0)", loaded);
  check(
    "QR present",
    await page
      .locator('img[alt="QR"]')
      .isVisible()
      .catch(() => false),
  );
  // rate 5 stars (fires feedback POST)
  await page.locator("button:has(i.fa-star)").nth(4).click();
  await page.screenshot({ path: `${ART}05-result.png`, fullPage: true });

  // ---------- Dashboard reflects the new image ----------
  console.log("DASHBOARD — stats from API");
  await page.goto(`${FE}/dashboard`, { waitUntil: "networkidle" });
  const label = page.getByText("ภาพที่สร้าง", { exact: true });
  await label.waitFor({ timeout: 8000 });
  const imagesCard = await page
    .locator("div.glass")
    .filter({ has: label })
    .first()
    .innerText();
  const n = parseInt((imagesCard.match(/\d+/) || ["0"])[0], 10);
  check("dashboard images_total >= 1", n >= 1);
  await page.screenshot({ path: `${ART}06-dashboard.png`, fullPage: true });
} catch (e) {
  console.error("E2E ERROR:", e.message);
  await page.screenshot({ path: `${ART}error.png`, fullPage: true }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}

console.log(failures === 0 ? "\nE2E PASSED ✅" : `\nE2E FAILED ❌ (${failures})`);
process.exit(failures === 0 ? 0 : 1);
