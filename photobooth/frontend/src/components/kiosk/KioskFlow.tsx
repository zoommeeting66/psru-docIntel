"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Consent, Job, Outfit, Output, Scene } from "@/lib/types";
import { Stepper } from "@/components/Stepper";
import { ConsentStep } from "./ConsentStep";
import { CaptureStep } from "./CaptureStep";
import { SceneStep } from "./SceneStep";
import { RenderStep } from "./RenderStep";
import { ResultStep } from "./ResultStep";

type Step = 1 | 2 | 3 | 4 | 5;
const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

export function KioskFlow() {
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [sceneName, setSceneName] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [output, setOutput] = useState<Output | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    wsRef.current = null;
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const finalize = useCallback(async (outputId: string) => {
    try {
      const out = await api.getOutput(outputId);
      setOutput(out);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดึงผลลัพธ์ไม่สำเร็จ");
      setStep(3);
    }
  }, []);

  const onSnapshot = useCallback(
    (j: Job) => {
      setJob(j);
      if (TERMINAL.has(j.status)) {
        doneRef.current = true;
        cleanup();
        if (j.status === "succeeded" && j.output_id) finalize(j.output_id);
        else {
          setError(`งานล้มเหลว (${j.status})`);
          setStep(3);
        }
      }
    },
    [cleanup, finalize],
  );

  // Fallback: poll GET /jobs/{id} if the WebSocket is unavailable.
  const startPolling = useCallback(
    (jobId: string) => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          onSnapshot(await api.getJob(jobId));
        } catch (e) {
          cleanup();
          setError(e instanceof Error ? e.message : "ติดตามงานไม่สำเร็จ");
          setStep(3);
        }
      }, 600);
    },
    [cleanup, onSnapshot],
  );

  // Primary: stream progress over WebSocket, fall back to polling on failure.
  const watch = useCallback(
    (jobId: string) => {
      doneRef.current = false;
      try {
        const ws = new WebSocket(api.wsJobUrl(jobId));
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          const data = JSON.parse(ev.data);
          if (data.error) return;
          onSnapshot(data as Job);
        };
        ws.onerror = () => {
          if (!doneRef.current) startPolling(jobId);
        };
        ws.onclose = () => {
          if (!doneRef.current) startPolling(jobId);
        };
      } catch {
        startPolling(jobId);
      }
    },
    [onSnapshot, startPolling],
  );

  // STEP 1 → 2
  const startSession = useCallback(async (c: Consent) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.createSession("kiosk");
      await api.addConsent(s.id, c);
      setSessionId(s.id);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เริ่ม session ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, []);

  // STEP 2 → 3
  const upload = useCallback(
    async (blob: Blob) => {
      if (!sessionId) return;
      setBusy(true);
      setError(null);
      try {
        const cap = await api.uploadCapture(sessionId, blob);
        setCaptureId(cap.id);
        const [sc, of] = await Promise.all([api.listScenes(), api.listOutfits()]);
        setScenes(sc);
        setOutfits(of);
        setStep(3);
      } catch (e) {
        setError(e instanceof Error ? e.message : "อัปโหลดภาพไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  // STEP 3 → 4 → 5
  const render = useCallback(
    async (
      sceneId: string,
      outfitId: string | null,
      fx: Record<string, boolean>,
    ) => {
      if (!captureId) return;
      setSceneName(scenes.find((s) => s.id === sceneId)?.name ?? "PSRU");
      setJob(null);
      setStep(4);
      setError(null);
      try {
        const created = await api.createJob({
          capture_id: captureId,
          scene_id: sceneId,
          outfit_id: outfitId ?? undefined,
          fx,
        });
        setJob(created);
        watch(created.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "สร้างงานไม่สำเร็จ");
        setStep(3);
      }
    },
    [captureId, scenes, watch],
  );

  const reset = useCallback(() => {
    cleanup();
    setSessionId(null);
    setCaptureId(null);
    setScenes([]);
    setOutfits([]);
    setJob(null);
    setOutput(null);
    setError(null);
    setStep(1);
  }, [cleanup]);

  return (
    <div>
      <Stepper current={step} />
      {error && (
        <div className="max-w-2xl mx-auto mb-4 glass rounded-2xl p-3 text-amber-700 text-sm">
          <i className="fa-solid fa-triangle-exclamation mr-2" />
          {error} — ตรวจสอบว่า backend ทำงานอยู่ที่ {""}
          <code>http://localhost:8000</code>
        </div>
      )}

      {step === 1 && <ConsentStep onAccept={startSession} busy={busy} />}
      {step === 2 && <CaptureStep onCapture={upload} busy={busy} />}
      {step === 3 && (
        <SceneStep scenes={scenes} outfits={outfits} onRender={render} />
      )}
      {step === 4 && <RenderStep job={job} />}
      {step === 5 && output && (
        <ResultStep output={output} sceneName={sceneName} onReset={reset} />
      )}
    </div>
  );
}
