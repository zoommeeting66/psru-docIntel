# PSRU Photo Booth — E2E (Playwright)

End-to-end test that drives the **full Kiosk flow in a real browser** against the
live frontend (`:3000`) + Core API (`:8000`), then checks the Executive dashboard.

## What it verifies (`kiosk.e2e.mjs`)

1. **Consent (PDPA)** — API health badge connects; accept consent
2. **Capture** — webcam (fake media device) → upload
3. **Scene** — scenes loaded from the API; pick one
4. **Render** — render step shows while progress streams over **WebSocket** (`/ws/jobs/{id}`)
5. **Result** — the real **API-served image renders** (`naturalWidth > 0`) and the **QR** is shown;
   asserts a WebSocket was opened and delivered a terminal frame; rate 5★ (fires feedback)
6. **Dashboard (RBAC)** — `/dashboard` is gated by a login card; logs in as
   **executive** (dev-token), then `/stats` reflects `images_total ≥ 1`

Screenshots are written to `artifacts/` (git-ignored).

## Run

```bash
# 1) start backend
cd ../backend && source .venv/bin/activate
PUBLIC_BASE_URL=http://localhost:8000 uvicorn app.main:app --port 8000 &

# 2) build + start frontend
cd ../frontend && npm run build && npx next start -p 3000 &

# 3) run the test
cd ../e2e && npm install && npm test
```

### Browser
Uses the pre-installed Chromium via `executablePath` (`/opt/pw-browsers/chromium`,
override with `CHROME_BIN`) and fake media-stream flags so the camera path runs
headless. Override the frontend URL with `FE_BASE`.

> Note: this sandbox blocks the Font Awesome CDN, so icon glyphs are absent in
> screenshots — purely cosmetic; all functional assertions pass.
