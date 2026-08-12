import { useEffect, useRef } from "react";
import { drawMosesArt, MOSES_ART } from "@/game/mosesArt";
import { drawPixelShadow } from "@/game/shadow";

/**
 * Moses exactly as he appears in gameplay: the same supplied pixel-art PNG
 * (body + his own staff) at native pixel density, rendered into a small canvas
 * and scaled up with `image-rendering: pixelated`, so no pixel is ever resampled.
 *
 * Subtle idle loop: slow breathing bob and a gentle staff sway.
 */
export function MosesMenuSprite({ zoom = 3, className }: { zoom?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const W = MOSES_ART.W;
  const H = MOSES_ART.H + 8;

  useEffect(() => {
    const cnv = ref.current;
    if (!cnv) return;
    const ctx = cnv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Breathing: one sprite-pixel rise and fall, stepped so it stays on grid.
      const breath = Math.round(Math.sin(t * 1.5) * 0.5 - 0.5);
      const groundY = H - 4;

      drawPixelShadow(ctx, W / 2, groundY, 30, { px: 3, alpha: 0.24, seed: 7 });
      drawMosesArt(ctx, {
        x: W / 2,
        groundY: groundY + breath,
        flip: 1,
        walkPhase: 0,
        moving: false,
        bob: 0,
        // Gentle sway of the staff he already holds.
        staffAngle: Math.sin(t * 0.9) * 0.04,
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [H]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      aria-label="Moses holding his shepherd's staff"
      className={className}
      style={{ width: W * zoom, height: H * zoom, imageRendering: "pixelated" }}
    />
  );
}
