// Glossy painted icons (v2) for bonuses and the run HUD. The older pixel-art
// grids (BONUS_ART, MEDAL/CLOCK/SKULL_ART) are kept in the code as a fallback.
import lightning from "@/assets/icon-v2-lightning.png";
import heart from "@/assets/icon-v2-heart.png";
import star from "@/assets/icon-v2-star.png";
import magnet from "@/assets/icon-v2-magnet.png";
import shield from "@/assets/icon-v2-shield.png";
import level from "@/assets/icon-v2-level.png";
import clock from "@/assets/icon-v2-clock.png";
import skull from "@/assets/icon-v2-skull.png";
import type { BonusKind } from "./bonuses";

export const ICON_V2 = { lightning, heart, star, magnet, shield, level, clock, skull } as const;
export type IconV2 = keyof typeof ICON_V2;

/** Bonus pickup → its v2 icon (all five bonuses have one). */
export const BONUS_ICON: Record<BonusKind, string> = { heart, magnet, star, lightning, shield };

/** Level-up blessing (passive id) → v2 icon, when it has one. */
export const PASSIVE_ICON: Record<string, string> = { maxHp: heart, shield, speed: lightning, magnet };

const cache = new Map<string, HTMLImageElement>();
/** Loaded image for canvas drawing (null until it has loaded). */
export function iconImage(url: string): HTMLImageElement | null {
  let img = cache.get(url);
  if (!img) { img = new Image(); img.src = url; cache.set(url, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
