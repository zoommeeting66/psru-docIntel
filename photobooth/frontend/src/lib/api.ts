// Typed client for the PSRU Photo Booth Core API.
import type {
  Capture,
  Consent,
  Job,
  Outfit,
  Output,
  PopularScene,
  Scene,
  Session,
  Share,
  StatsOverview,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

const V1 = `${API_BASE}/api/v1`;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Bearer token (set by the auth provider). Attached to every request.
let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers || {});
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const res = await fetch(`${V1}${path}`, { ...opts, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = (data && (data.detail || data.message)) || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => req<{ status: string; queue_depth: number }>("/health"),

  // auth
  authConfig: () =>
    req<{ oidc_enabled: boolean; issuer: string; dev_mode: boolean }>(
      "/auth/config",
    ),
  devToken: (role: string) =>
    req<{ access_token: string; token_type: string; role: string }>(
      "/auth/dev-token",
      json({ role }),
    ),
  me: () =>
    req<{ sub: string; role: string; anonymous: boolean }>("/auth/me"),

  // sessions / consent / capture
  createSession: (channel: string, event_id?: string, device_id?: string) =>
    req<Session>("/sessions", json({ channel, event_id, device_id })),
  addConsent: (sid: string, c: Consent) =>
    req<{ id: string }>(`/sessions/${sid}/consent`, json(c)),
  uploadCapture: (sid: string, file: Blob, source_type = "kiosk") => {
    const fd = new FormData();
    fd.append("file", file, "capture.jpg");
    fd.append("source_type", source_type);
    return req<Capture>(`/sessions/${sid}/captures`, { method: "POST", body: fd });
  },

  // catalog
  listScenes: () => req<Scene[]>("/scenes"),
  listOutfits: () => req<Outfit[]>("/outfits"),

  // jobs
  createJob: (body: {
    capture_id: string;
    scene_id: string;
    outfit_id?: string;
    branding_id?: string;
    fx?: Record<string, unknown>;
  }) => req<Job>("/jobs", json(body)),
  getJob: (id: string) => req<Job>(`/jobs/${id}`),

  // outputs
  getOutput: (id: string) => req<Output>(`/outputs/${id}`),
  shareOutput: (id: string) =>
    req<Share>(`/outputs/${id}/share`, { method: "POST" }),
  feedback: (id: string, rating: number, comment?: string) =>
    req<unknown>(`/outputs/${id}/feedback`, json({ rating, comment })),
  qrUrl: (id: string) => `${V1}/outputs/${id}/qr`,
  downloadUrl: (id: string, fmt = "png") =>
    `${V1}/outputs/${id}/download?fmt=${fmt}`,
  // ws:// or wss:// depending on the API scheme
  wsJobUrl: (id: string) => `${V1.replace(/^http/, "ws")}/ws/jobs/${id}`,

  // stats
  statsOverview: () => req<StatsOverview>("/stats/overview"),
  popularScenes: () => req<PopularScene[]>("/stats/scenes"),
};
