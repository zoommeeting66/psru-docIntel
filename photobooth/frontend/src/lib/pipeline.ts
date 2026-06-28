// Pipeline stage keys mirror backend/app/pipeline.py STAGES.
export const PIPELINE: { key: string; label: string }[] = [
  { key: "segmentation", label: "Segmentation (SAM 2)" },
  { key: "face_pose", label: "Face & Pose" },
  { key: "scene_generate", label: "Scene Generate (SDXL)" },
  { key: "relight", label: "Relighting (IC-Light)" },
  { key: "perspective", label: "Perspective Match" },
  { key: "beauty", label: "Beauty Enhance" },
  { key: "outfit", label: "AI Outfit" },
  { key: "branding", label: "Branding Engine" },
];

export const FX_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: "snow", label: "หิมะ", icon: "fa-snowflake" },
  { key: "rain", label: "ฝน", icon: "fa-cloud-rain" },
  { key: "confetti", label: "Confetti", icon: "fa-shapes" },
  { key: "fireworks", label: "พลุ", icon: "fa-burst" },
  { key: "sunset", label: "พระอาทิตย์ตก", icon: "fa-sun" },
  { key: "fog", label: "หมอก", icon: "fa-smog" },
  { key: "flowers", label: "ดอกไม้", icon: "fa-spa" },
];
