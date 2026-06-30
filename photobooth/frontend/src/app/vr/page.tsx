"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VR_ENVS, makePanorama } from "@/lib/panorama";

export default function VrPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [env, setEnv] = useState(0);
  const [webglOk, setWebglOk] = useState(true);
  const [xrSupported, setXrSupported] = useState(false);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // build the three.js scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setWebglOk(false);
      return;
    }
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.xr.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      72,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000,
    );

    // inward-facing sphere = panorama
    const geometry = new THREE.SphereGeometry(50, 64, 40);
    geometry.scale(-1, 1, 1); // render the inside
    const texture = new THREE.CanvasTexture(makePanorama(VR_ENVS[0]));
    texture.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = texture;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // look controls (drag) + gentle auto-rotate
    let lon = 0;
    let lat = 0;
    let dragging = false;
    let px = 0;
    let py = 0;
    let lastInteract = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      px = e.clientX;
      py = e.clientY;
      lastInteract = Date.now();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      lon -= (e.clientX - px) * 0.15;
      lat += (e.clientY - py) * 0.15;
      lat = Math.max(-85, Math.min(85, lat));
      px = e.clientX;
      py = e.clientY;
      lastInteract = Date.now();
    };
    const onUp = () => (dragging = false);
    const el = renderer.domElement;
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    renderer.setAnimationLoop(() => {
      if (!dragging && Date.now() - lastInteract > 2500) lon += 0.03; // idle drift
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      );
      renderer.render(scene, camera);
    });

    // WebXR availability
    const nav = navigator as Navigator & { xr?: { isSessionSupported(m: string): Promise<boolean> } };
    nav.xr?.isSessionSupported?.("immersive-vr").then(setXrSupported).catch(() => {});

    return () => {
      renderer.setAnimationLoop(null);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  // swap texture when the environment changes
  useEffect(() => {
    if (!textureRef.current) return;
    textureRef.current.image = makePanorama(VR_ENVS[env]);
    textureRef.current.needsUpdate = true;
  }, [env]);

  async function enterVR() {
    const renderer = rendererRef.current;
    const nav = navigator as Navigator & { xr?: { requestSession(m: string): Promise<XRSession> } };
    if (!renderer || !nav.xr) return;
    try {
      const session = await nav.xr.requestSession("immersive-vr");
      await renderer.xr.setSession(session as unknown as XRSession);
    } catch {
      /* user declined / unsupported */
    }
  }

  return (
    <div className="fadein">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-psru-greenDark">
            VR / 360° Experience
          </h1>
          <p className="text-psru-muted text-sm">
            ลากเพื่อมองรอบ · เลื่อนเลือกฉาก · กด Enter VR เมื่อใช้แว่น (WebXR)
          </p>
        </div>
        <button
          onClick={enterVR}
          disabled={!xrSupported}
          className="gradient-green text-white text-sm font-semibold px-4 py-2 rounded-xl shadow disabled:opacity-40"
          title={xrSupported ? "" : "อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับ immersive-vr"}
        >
          <i className="fa-solid fa-vr-cardboard mr-1" /> Enter VR
        </button>
      </div>

      <div className="glass rounded-3xl p-3 shadow-xl">
        {webglOk ? (
          <div
            ref={mountRef}
            className="relative w-full rounded-2xl overflow-hidden bg-psru-greenDeep"
            style={{ height: "60vh", cursor: "grab", touchAction: "none" }}
          >
            <div className="absolute top-3 left-3 z-10 text-white text-xs bg-black/40 px-2 py-1 rounded-full pointer-events-none">
              <i className="fa-solid fa-up-down-left-right mr-1" /> ลากเพื่อมองรอบ
            </div>
          </div>
        ) : (
          <div className="h-[40vh] flex flex-col items-center justify-center text-psru-muted">
            <i className="fa-solid fa-triangle-exclamation text-3xl mb-2" />
            เบราว์เซอร์นี้ไม่รองรับ WebGL — เปิดในเบราว์เซอร์ที่รองรับเพื่อชม 360°
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          {VR_ENVS.map((e, i) => (
            <button
              key={e.name}
              onClick={() => setEnv(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                i === env ? "gradient-green text-white" : "bg-white text-psru-muted"
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
