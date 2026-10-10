import { useEffect, useState } from "react";

/**
 * Gameplay is landscape-only on every platform. Tries the Screen Orientation
 * lock where permitted and falls back to viewport-dimension checks. Callers
 * pause the run while `portrait` is true; the run state is never reset.
 */
export function useLandscapeOnly(): boolean {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    const tryLock = () => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      o?.lock?.("landscape").catch(() => {});
    };
    check();
    tryLock();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    screen.orientation?.addEventListener?.("change", check);
    document.addEventListener("fullscreenchange", () => { check(); tryLock(); });
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
      screen.orientation?.removeEventListener?.("change", check);
    };
  }, []);
  return portrait;
}

export function RotateDeviceOverlay() {
  return (
    <div
      role="alertdialog"
      aria-label="Rotate your device"
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
      style={{ touchAction: "none" }}
    >
      <div className="pixel-panel flex max-w-xs flex-col items-center gap-4 bg-[#f6e2ad] px-6 py-6 text-center">
        <svg width="72" height="72" viewBox="0 0 18 18" shapeRendering="crispEdges" style={{ animation: "exodus-rotate-hint 1.8s steps(1) infinite" }} aria-hidden="true">
          <rect x="6" y="2" width="6" height="14" fill="#6b4520" />
          <rect x="7" y="3" width="4" height="11" fill="#e8c27a" />
          <rect x="8" y="14" width="2" height="1" fill="#e8c27a" />
        </svg>
        <p className="font-pixel text-base text-[#6b4520]">Rotate your device</p>
        <p className="font-pixel text-xs text-[#8a5a2b]">Exodus Survivors is played in landscape. Your run is paused.</p>
      </div>
      <style>{`@keyframes exodus-rotate-hint{0%,45%{transform:rotate(0deg)}50%,100%{transform:rotate(90deg)}}`}</style>
    </div>
  );
}
