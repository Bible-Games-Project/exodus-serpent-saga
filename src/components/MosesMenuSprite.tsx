import { useEffect, useRef } from "react";
import { MOSES_NOSTAFF, renderSprite } from "@/game/sprites";
import { drawShepherdStaff } from "@/game/staff";

/**
 * Moses exactly as he appears in gameplay: the same MOSES_NOSTAFF sprite at the
 * same pixel density (3 CSS px per sprite pixel) plus the same programmatic
 * shepherd's staff. Rendered at native density into a small canvas and scaled
 * up with `image-rendering: pixelated`, so no pixel is ever resampled.
 *
 * Subtle idle loop: slow breathing bob, an occasional shift of weight (frame
 * swap) and a gentle staff sway.
 */
export function MosesMenuSprite({ zoom = 3, className }: { zoom?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const W = 96;
  const H = 104;

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

      // Breathing: 1 sprite-pixel (3 canvas px) rise and fall, stepped so it
      // stays on the pixel grid instead of sliding smoothly.
      const breath = Math.round(Math.sin(t * 1.5) * 0.5 - 0.5) * 3;
      // Weight shift every ~2.4s — reuses the walk frames as a slight idle sway.
      const frame = Math.sin(t * 1.3) > 0.86 ? 1 : 0;

      const img = renderSprite(MOSES_NOSTAFF, frame, 3, false);
      const baseX = Math.round((W - img.width) / 2);
      const baseY = H - img.height - 6 + breath;

      // Pixel-art ground shadow (same language as gameplay).
      drawPixelShadow(ctx, W / 2, H - 5, img.width * 0.7, { px: 3, alpha: 0.24, seed: 7 });


      ctx.drawImage(img, baseX, baseY);

      // Staff: same renderer and length as gameplay idle, near-vertical with a
      // slow sway.
      const rot = -Math.PI / 2 + 0.1 + Math.sin(t * 0.9) * 0.05;
      drawShepherdStaff(ctx, W / 2 + 8, baseY + img.height - 28, rot, 1, 46);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

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
