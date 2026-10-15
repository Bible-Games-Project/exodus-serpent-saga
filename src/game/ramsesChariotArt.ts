// Ramses' war chariot (phase 4) built from the supplied chariot PNG. The art is
// split non-destructively: the source asset is untouched; derived layers hold
// the body (with the painted wheel removed), four horse legs and the supplied
// wheel, which spins on the exact centre of the original wheel.
// RAMSES_CHARIOT_VERSION = "original" restores the old procedural chariot.
import bodyAsset from "@/assets/ramses-chariot-v2-body.png.asset.json";
import wheelAsset from "@/assets/ramses-chariot-v2-wheel.png.asset.json";
import legHbAsset from "@/assets/ramses-chariot-v2-leg-hb.png.asset.json";
import legHfAsset from "@/assets/ramses-chariot-v2-leg-hf.png.asset.json";
import legFbAsset from "@/assets/ramses-chariot-v2-leg-fb.png.asset.json";
import legFfAsset from "@/assets/ramses-chariot-v2-leg-ff.png.asset.json";

export const RAMSES_CHARIOT_VERSION: "original" | "new" = "new";

export const RAMSES_CHARIOT_ART = {
  W: 614,
  H: 410,
  /** screen px per layer px */
  PX: 0.5,
  /** rig centre x and ground line (hooves) inside the layers */
  CX: 304,
  GROUND: 389,
  WHEEL: { x: 98.4, y: 314, size: 141 },
  /** hip line where the leg layers hinge */
  HIP: 316,
} as const;

// Diagonal pairs move together (trot): hind-near with fore-far, and vice versa.
const LEGS: Array<{ key: string; x: number; offset: number }> = [
  { key: "hb", x: 354, offset: 0 },
  { key: "hf", x: 395.4, offset: Math.PI },
  { key: "fb", x: 508.4, offset: Math.PI },
  { key: "ff", x: 540.4, offset: 0 },
];

let body: HTMLImageElement | null = null;
let wheel: HTMLImageElement | null = null;
let legs: Record<string, HTMLImageElement> | null = null;
const load = (u: string) => { const i = new Image(); i.src = u; return i; };
const ok = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;

export function ensureRamsesChariotArt(): boolean {
  if (typeof document === "undefined" || RAMSES_CHARIOT_VERSION !== "new") return false;
  if (!body) body = load(bodyAsset.url);
  if (!wheel) wheel = load(wheelAsset.url);
  if (!legs) legs = { hb: load(legHbAsset.url), hf: load(legHfAsset.url), fb: load(legFbAsset.url), ff: load(legFfAsset.url) };
  return ok(body) && ok(wheel) && Object.values(legs).every(ok);
}

/** Draws the chariot with its feet on (x, groundY). phase drives the stride, wheelAngle the roll. */
export function drawRamsesChariot(ctx: CanvasRenderingContext2D, x: number, groundY: number, flip: 1 | -1, phase: number, wheelAngle: number): boolean {
  if (!ensureRamsesChariotArt() || !body || !wheel || !legs) return false;
  const { W, H, PX, CX, GROUND, WHEEL, HIP } = RAMSES_CHARIOT_ART;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(Math.round(x), Math.round(groundY + (Math.sin(phase * 2) > 0.6 ? -1 : 0)));
  if (flip === -1) ctx.scale(-1, 1);
  ctx.scale(PX, PX);
  ctx.translate(-CX, -GROUND);
  // Legs first: each swings around its hip; the body layer overlaps the hinge.
  for (const l of LEGS) {
    const a = Math.sin(phase + l.offset) * 0.2;
    ctx.save();
    ctx.translate(l.x, HIP);
    ctx.rotate(a);
    ctx.translate(-l.x, -HIP - Math.max(0, Math.sin(phase + l.offset)) * 4);
    ctx.drawImage(legs[l.key], 0, 0, W, H);
    ctx.restore();
  }
  ctx.drawImage(body, 0, 0, W, H);
  // Supplied wheel, rotating around the original wheel's hub.
  ctx.save();
  ctx.translate(WHEEL.x, WHEEL.y);
  ctx.rotate(wheelAngle);
  ctx.drawImage(wheel, -WHEEL.size / 2, -WHEEL.size / 2, WHEEL.size, WHEEL.size);
  ctx.restore();
  ctx.restore();
  return true;
}
