// Weapon muzzles: every ranged enemy releases its projectile from the actual
// visual point on its weapon (bow string, spear tip, staff crystal), never from
// the middle of its body. The offsets live in each sprite's own pixel space and
// are converted here, so they stay correct as the enemy moves and turns.
import type { Entity } from "./types";
import { ARCHER_ART } from "./archerArt";
import { SPEAR_SOLDIER_ART } from "./spearSoldierArt";
import { MAGE_ART, MAGE_STAFF_TIP } from "./mageArt";
import { CHARIOT_ART, CHARIOT_BOW } from "./chariotArt";

type Muzzle = {
  /** point inside the sprite */
  mx: number;
  my: number;
  W: number;
  H: number;
  PX: number;
  CX: number;
  /** true when the unflipped art faces left (the sorcerer) */
  facesLeft?: boolean;
};

const MUZZLES: Record<string, Muzzle> = {
  // Bow grip / string release, just in front of the archer's leading hand.
  archer: { mx: 42, my: 26, ...ARCHER_ART },
  // Tip of the spear as it leaves his hand.
  spearsoldier: { mx: 790, my: 205, ...SPEAR_SOLDIER_ART },
  // The crystal at the head of the staff.
  mage: { mx: MAGE_STAFF_TIP.x, my: MAGE_STAFF_TIP.y, ...MAGE_ART, facesLeft: true },
  // Bow of the archer riding the chariot.
  chariotarcher: { mx: CHARIOT_BOW.x, my: CHARIOT_BOW.y, ...CHARIOT_ART },
};

/**
 * World-space release point of `owner`'s weapon. Sprites are drawn with their
 * feet/wheels at `pos.y + 8`, matching the renderers.
 */
export function weaponMuzzle(owner: Entity): { x: number; y: number } {
  const m = MUZZLES[owner.kind];
  if (!m) return { x: owner.pos.x, y: owner.pos.y - 24 };
  const flip = m.facesLeft
    ? (owner.facing === -1 ? 1 : -1)
    : (owner.facing === -1 ? -1 : 1);
  return {
    x: owner.pos.x + (m.mx - m.CX) * m.PX * flip,
    y: owner.pos.y + 8 - (m.H - m.my) * m.PX,
  };
}
