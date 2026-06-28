// Types mirroring the Core API (backend/app/schemas.py).

export type Channel = "web" | "mobile" | "kiosk" | "vr";

export interface Session {
  id: string;
  channel: string;
  status: string;
  started_at: string;
}

export interface Consent {
  biometric_ok: boolean;
  age_gender_ok: boolean;
  marketing_ok: boolean;
  policy_version: string;
}

export interface Capture {
  id: string;
  width?: number | null;
  height?: number | null;
  people_count: number;
  created_at: string;
}

export interface Scene {
  id: string;
  name: string;
  category?: string | null;
  thumbnail_url?: string | null;
  is_360: boolean;
  is_symbolic_restricted: boolean;
}

export interface Outfit {
  id: string;
  name: string;
  category?: string | null;
}

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export interface PipelineStep {
  status: "done" | "skipped" | "running";
  reason?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  stage?: string | null;
  output_id?: string | null;
  pipeline_steps: Record<string, PipelineStep>;
}

export interface Output {
  id: string;
  image_no?: string | null;
  final_url?: string | null;
  thumb_url?: string | null;
  formats: Record<string, string>;
  expires_at?: string | null;
}

export interface Share {
  share_token: string;
  share_url: string;
  qr_url: string;
  expires_at?: string | null;
}

export interface StatsOverview {
  sessions_total: number;
  images_total: number;
  downloads_total: number;
  avg_rating: number;
  avg_render_ms: number;
}

export interface PopularScene {
  scene_id: string;
  count: number;
}
