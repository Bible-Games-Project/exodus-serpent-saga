// Shared isolated equipment artwork for shop and Canvas; no combat rules here.
import manifest from "./equipmentManifest.json";
const urls: Record<string, string> = manifest;
export const HELMET_EXPERIMENT = true;
export const SHOES_EXPERIMENT = true;
export function equipmentArtUrl(category: string, id: string, evolution = 1): string | undefined {
  const kind = category === "shield" && HELMET_EXPERIMENT ? "helmet" : category;
  return urls[`${kind}:${id}:${kind === "helmet" ? 1 : evolution}`];
}
const images = new Map<string, HTMLImageElement>();
export function equipmentImage(category: string, id: string, evolution = 1): HTMLImageElement | null {
  const url = equipmentArtUrl(category, id, evolution);
  if (!url || typeof Image === "undefined") return null;
  let img = images.get(url);
  if (!img) { img = new Image(); img.src = url; images.set(url, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// Values describe visual gestures only; impact remains the engine's existing beat.
export function equipmentGesture(id: string, progress: number, evolution: number, rear = false): { angle: number; thrust: number } {
  const p = Math.max(0, Math.min(1, progress));
  const pulse = Math.sin(Math.PI * p);
  const rank = 1 + (evolution - 1) * .12;
  if (rear) {
    const gestures: Record<string, number> = { moses: -.28, iron: .18, crystal: -.38, diamond: -.46, bronze: .34, fire: -.5, bush: .42, waters: -.32, light: -.58, power: -.65 };
    return { angle: pulse * (gestures[id] ?? -.28) * rank, thrust: -pulse * (id === "iron" ? -2 : 2) };
  }
  if (id === "spear" || id === "harpoon") return { angle: pulse * 1.1, thrust: pulse * (id === "spear" ? 8 : 6) * rank };
  if (id === "boomerang" || id === "ring") return { angle: pulse * (id === "ring" ? 1.8 : 1.35) * rank, thrust: pulse * 4 };
  if (id === "dagger") return { angle: pulse * 1.2 * rank, thrust: pulse * 3 };
  if (id === "mace") return { angle: p < .4 ? -p * 1.8 : (p - .4) * 3.2, thrust: 0 };
  if (id === "axe") return { angle: p < .3 ? -p * 1.7 : (p - .3) * 2.8 * rank, thrust: 0 };
  if (id === "sword") return { angle: pulse * 2.0 * rank - .3, thrust: 0 };
  return { angle: p < .28 ? -.5 * p / .28 : -.5 + (1 - (1 - (p - .28) / .72) ** 2) * 2.5, thrust: 0 };
}

// Held sprites are rotated as a whole about their grip, not sliced into pieces.
export function drawHeldEquipment(ctx: CanvasRenderingContext2D, category: "weapon" | "staff", id: string, evolution: number, height: number): boolean {
  const img = equipmentImage(category, id, evolution);
  if (!img) return false;
  const width = img.naturalWidth / img.naturalHeight * height;
  const compact = id === "ring" || id === "boomerang";
  // Staff shafts sit left of their decorative crowns; diagonal weapon grips
  // stay at the lower-left end rather than the centre of their bounding box.
  const gripX = category === "weapon" && !compact ? width * .14 : category === "staff" ? width * .38 : width * .5;
  const gripY = compact ? height * .65 : category === "weapon" ? height * .87 : height * .74;
  ctx.drawImage(img, -gripX, -gripY, width, height);
  return true;
}