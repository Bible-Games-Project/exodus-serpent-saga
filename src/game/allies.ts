// Allied champion registry. Every champion is data here; the common ally
// system in engine.ts (movement, targeting, HP, death/grave/revival, invocation,
// recruitment) and the shared renderer in allyArt.ts read from it. Adding a new
// champion = add an entry here (plus its sprite), nothing else.
import miriamAsset from "@/assets/ally-miriam.png";
import miriamBodyAsset from "@/assets/ally-miriam-body.png";
import miriamBroomAsset from "@/assets/ally-miriam-broom.png";
import miriamHandAsset from "@/assets/ally-miriam-hand.png";
import aaronAsset from "@/assets/ally-aaron.png";
import jochebedAsset from "@/assets/ally-jochebed.png";
import zipporahAsset from "@/assets/ally-zipporah-supplied.png";
import zipporahBody from "@/assets/ally-zipporah-body.png";
import zipporahAction from "@/assets/ally-zipporah-action.png";
import puahAsset from "@/assets/ally-puah-clean-supplied.png";
import puahBody from "@/assets/ally-puah-clean-body.png";
import puahAction from "@/assets/ally-puah-clean-action.png";
import shiphrahAsset from "@/assets/ally-shiphrah-clean-supplied.png";
import shiphrahBody from "@/assets/ally-shiphrah-clean-body.png";
import shiphrahAction from "@/assets/ally-shiphrah-clean-action.png";
import gershomAsset from "@/assets/ally-gershom-clean-supplied.png";
import gershomBody from "@/assets/ally-gershom-clean-body.png";
import gershomAction from "@/assets/ally-gershom-clean-action.png";
import eliezerAsset from "@/assets/ally-eliezer-clean-supplied.png";
import eliezerBody from "@/assets/ally-eliezer-clean-body.png";
import eliezerAction from "@/assets/ally-eliezer-clean-action.png";
import amramAsset from "@/assets/ally-amram-clean-supplied.png";
import amramBody from "@/assets/ally-amram-clean-body.png";
import amramAction from "@/assets/ally-amram-clean-action.png";
import jethroAsset from "@/assets/ally-jethro-v2.png";
import ithamarAsset from "@/assets/ally-ithamar-v2.png";
import nadabAsset from "@/assets/ally-nadab-supplied.png";
import abihuAsset from "@/assets/ally-abihu-supplied.png";
import eleazarAsset from "@/assets/ally-eleazar-supplied.png";
import type { NpcId } from "./types";

export type AllyAttackKind =
  | "broom" | "water" | "horn"
  // shop champions (behaviour in championAbilities.ts)
  | "stone" | "heal" | "vial" | "arrow" | "spear" | "pyramid"
  | "convert" | "ward" | "fireball" | "firering" | "beam";

export type AllyDef = {
  id: NpcId;
  name: string;
  description: string;
  scripture: string;
  sprite: {
    url: string;
    W: number;
    H: number;
    /** body centre column */
    CX: number;
    /** first row of the feet band that steps during the walk */
    FOOT_TOP: number;
    /** feet band columns [x0, x1) and the split between the two feet */
    FOOT_X0: number;
    FOOT_X1: number;
    FOOT_SPLIT: number;
    /** where the attack effect originates (sprite px, facing right) */
    FX: { x: number; y: number };
    /** uniform visual scale (gameplay stats are unaffected) */
    scale?: number;
    /**
     * Temporary placeholder: the sprite borrows another champion's PNG, tinted
     * with this hue and labelled in-game. Remove when the final PNG arrives.
     */
    placeholderHue?: number;
    /** Fuller walk for long-dress sprites: feet stride and lift under the hem,
     *  the body bobs and rocks as one piece (sprite units). */
    walk?: { stride: number; lift: number; bob: number; rock: number };
  };
  /**
   * Optional held weapon drawn as its own complete layer (never sliced by the
   * walk). `url` is the full sprite for previews; the renderer uses
   * `bodyUrl` + `weaponUrl` + `handUrl` (fingers drawn over the grip).
   */
  weapon?: {
    bodyUrl: string;
    weaponUrl: string;
    handUrl: string;
    /** grip the weapon rotates around (sprite px, facing right) */
    pivot: { x: number; y: number };
    /** weapon head that delivers the hit (sprite px, facing right) */
    tip: { x: number; y: number };
    /** rotation (rad, facing right; negative = raise forward) at full swing */
    swingAngle: number;
    /** rotation (rad) at the end of the preparation */
    windupAngle: number;
  };
  /** Original-pixel action layer, anchored at the shoulder or grip. */
  gesture?: { bodyUrl: string; actionUrl: string; pivot: { x: number; y: number }; angle: number };
  /** fraction of the action phase at which the hit lands (default 0) */
  impactFrac?: number;
  /** each hit deals the current Staff of Moses damage (kept in sync with it) */
  staffDamage?: boolean;
  maxHp: number;
  /** base damage per hit (scaled by Moses' damage multiplier) */
  damage: number;
  /** seconds between attacks */
  cooldown: number;
  /** distance at which the attack can start */
  range: number;
  /** area radius of the hit (broom dust / water splash / horn wave reach) */
  hitRadius: number;
  moveSpeed: number;
  /** attack timeline: preparation, then action; impact happens at action start */
  windup: number;
  action: number;
  attack: AllyAttackKind;
  /** radius of the one-shot invocation blast when recruited */
  invokeRadius: number;
};

function champ(
  id: string, name: string, description: string, scripture: string, sprite: AllyDef["sprite"],
  o: Pick<AllyDef, "cooldown" | "range" | "hitRadius" | "moveSpeed" | "attack">,
): AllyDef {
  // maxHp / damage are overridden at summon time from the shop evolution.
  return { id: id as NpcId, name, description, scripture, sprite, maxHp: 3400, damage: 26, windup: 0.25, action: 0.3, invokeRadius: 150, ...o };
}

/** Miriam (Evolution 1) is the 100% attack / 100% health reference. */
export const CHAMPION_REFERENCE_HP = 3400;


/** Supplied art retains its complete silhouette; only its original arm/weapon pixels move. */
function suppliedSprite(url: string, cx: number, feet: number, x0: number, x1: number, split: number, fx: { x: number; y: number }): AllyDef["sprite"] {
  return { url, W: 85, H: 128, CX: cx, FOOT_TOP: feet, FOOT_X0: x0, FOOT_X1: x1, FOOT_SPLIT: split, FX: fx, scale: 0.65 };
}
function suppliedChampion(def: AllyDef, bodyUrl: string, actionUrl: string, pivot: { x: number; y: number }, angle: number): AllyDef {
  return { ...def, impactFrac: 0.35, gesture: { bodyUrl, actionUrl, pivot, angle } };
}

// Balance profiles:
//  Miriam   — glass cannon: low HP, broom hits as hard as the Staff of Moses, fastest attacks.
//  Jochebed — tank: very high HP, low damage, moderate (not fast) attacks.
//  Aaron    — high HP and high damage, but a clearly longer cooldown.
export const ALLIES: Record<string, AllyDef> = {
  miriam: {
    id: "miriam",
    name: "Miriam",
    description: "Moses' sister. Fragile, but her broom strikes hard and often.",
    scripture: "Exodus 15:20 — Miriam the prophetess, the sister of Aaron, took a timbrel in her hand.",
    sprite: { url: miriamAsset, W: 44, H: 86, CX: 16, FOOT_TOP: 79, FOOT_X0: 6, FOOT_X1: 28, FOOT_SPLIT: 17, FX: { x: 37, y: 78 }, scale: 0.8 },
    weapon: {
      bodyUrl: miriamBodyAsset,
      weaponUrl: miriamBroomAsset,
      handUrl: miriamHandAsset,
      pivot: { x: 16, y: 29 },
      tip: { x: 37, y: 78 },
      swingAngle: -1.05,
      windupAngle: 0.35,
    },
    impactFrac: 0.35,
    staffDamage: true,
    maxHp: 3400, // same as Aaron
    damage: 26,
    cooldown: 0.75,
    // Matches the broom's on-screen reach (pivot -> head at full swing).
    range: 40,
    hitRadius: 30,
    moveSpeed: 95,
    windup: 0.22,
    action: 0.3,
    attack: "broom",
    invokeRadius: 150,
  },
  jochebed: {
    id: "jochebed",
    name: "Jochebed",
    description: "Moses' mother. Endures almost anything; throws water from her basket.",
    scripture: "Exodus 2:3 — She took for him an ark of bulrushes... and put the child therein.",
    sprite: { url: jochebedAsset, W: 42, H: 82, CX: 14, FOOT_TOP: 77, FOOT_X0: 6, FOOT_X1: 25, FOOT_SPLIT: 15, FX: { x: 36, y: 48 }, scale: 0.8 },
    maxHp: 4800,
    damage: 7,
    cooldown: 1.4,
    range: 190,
    hitRadius: 34,
    moveSpeed: 68,
    windup: 0.3,
    action: 0.26,
    attack: "water",
    invokeRadius: 150,
  },
  aaron: {
    id: "aaron",
    name: "Aaron",
    description: "Moses' brother. Sturdy and powerful; his horn blast needs time to recover.",
    scripture: "Exodus 4:14 — Is not Aaron the Levite thy brother? I know that he can speak well.",
    sprite: { url: aaronAsset, W: 47, H: 88, CX: 16, FOOT_TOP: 80, FOOT_X0: 3, FOOT_X1: 30, FOOT_SPLIT: 15, FX: { x: 45, y: 6 }, scale: 1.0 },
    maxHp: 3400,
    damage: 40,
    cooldown: 2.8,
    range: 150,
    hitRadius: 150,
    moveSpeed: 80,
    windup: 0.38,
    action: 0.55,
    attack: "horn",
    invokeRadius: 150,
  },

  // ---- Supplied shop champions (all use the user's PNGs) ------
  // Gameplay never depends on the sprite.
  zipporah: suppliedChampion(champ("zipporah", "Zipporah", "Moses' wife. Throws fast stones.", "Exodus 2:21 — He gave Moses Zipporah his daughter.", suppliedSprite(zipporahAsset, 39, 116, 25, 60, 43, { x: 11, y: 17 }), { cooldown: 1.0, range: 260, hitRadius: 14, moveSpeed: 92, attack: "stone" }), zipporahBody, zipporahAction, { x: 26, y: 36 }, -0.85),
  puah: suppliedChampion(champ("puah", "Puah", "Midwife. Heals Moses and champions with vials and keeps her distance.", "Exodus 1:15-17 — The midwives feared God.", suppliedSprite(puahAsset, 38, 116, 29, 49, 40, { x: 79, y: 33 }), { cooldown: 4.4, range: 320, hitRadius: 60, moveSpeed: 90, attack: "heal" }), puahBody, puahAction, { x: 55, y: 37 }, -0.35),
  shiphrah: suppliedChampion(champ("shiphrah", "Shiphrah", "Midwife. Throws explosive vials.", "Exodus 1:15-17 — The midwives feared God.", { ...suppliedSprite(shiphrahAsset, 39, 116, 20, 66, 43, { x: 11, y: 16 }), walk: { stride: 3, lift: 4, bob: 2, rock: 0.035 } }, { cooldown: 1.6, range: 240, hitRadius: 60, moveSpeed: 85, attack: "vial" }), shiphrahBody, shiphrahAction, { x: 26, y: 36 }, -0.85),
  gershom: suppliedChampion(champ("gershom", "Gershom", "Moses' firstborn. An archer.", "Exodus 2:22 — I have been a stranger in a strange land.", suppliedSprite(gershomAsset, 33, 115, 16, 56, 35, { x: 77, y: 32 }), { cooldown: 1.1, range: 320, hitRadius: 12, moveSpeed: 88, attack: "arrow" }), gershomBody, gershomAction, { x: 61, y: 35 }, -0.08),
  eliezer: suppliedChampion(champ("eliezer", "Eliezer", "Moses' second son. Throws a piercing spear.", "Exodus 18:4 — The God of my father was mine help.", suppliedSprite(eliezerAsset, 41, 109, 20, 62, 41, { x: 76, y: 19 }), { cooldown: 1.5, range: 280, hitRadius: 12, moveSpeed: 86, attack: "spear" }), eliezerBody, eliezerAction, { x: 17, y: 48 }, -0.55),
  amram: suppliedChampion(champ("amram", "Amram", "Moses' father. Hurls pyramid stones that crack the ground.", "Exodus 6:20 — Amram took Jochebed to wife.", suppliedSprite(amramAsset, 42, 114, 35, 51, 43, { x: 43, y: 12 }), { cooldown: 2.4, range: 260, hitRadius: 70, moveSpeed: 72, attack: "pyramid" }), amramBody, amramAction, { x: 43, y: 49 }, 0.25),
  jethro: champ("jethro", "Jethro", "Priest of Midian. Turns and confuses enemies.", "Exodus 18:1 — Jethro, the priest of Midian, Moses' father in law.", suppliedSprite(jethroAsset, 42, 116, 30, 54, 42, { x: 78, y: 15 }), { cooldown: 1.0, range: 260, hitRadius: 200, moveSpeed: 78, attack: "convert" }),
  ithamar: champ("ithamar", "Ithamar", "Aaron's son. Raises protective wards instead of attacking.", "Exodus 38:21 — By the hand of Ithamar.", suppliedSprite(ithamarAsset, 44, 116, 34, 56, 45, { x: 12, y: 15 }), { cooldown: 1.0, range: 400, hitRadius: 46, moveSpeed: 82, attack: "ward" }),
  nadab: champ("nadab", "Nadab", "Aaron's firstborn. Throws exploding fireballs.", "Leviticus 10:1 — Nadab and Abihu offered strange fire.", suppliedSprite(nadabAsset, 40, 116, 28, 52, 40, { x: 77, y: 37 }), { cooldown: 1.5, range: 280, hitRadius: 60, moveSpeed: 84, attack: "fireball" }),
  abihu: champ("abihu", "Abihu", "Aaron's second son. Surrounds himself with fire.", "Leviticus 10:1 — Nadab and Abihu offered strange fire.", suppliedSprite(abihuAsset, 40, 116, 28, 52, 40, { x: 75, y: 38 }), { cooldown: 4.0, range: 120, hitRadius: 70, moveSpeed: 90, attack: "firering" }),
  eleazar: champ("eleazar", "Eleazar", "Aaron's son. Fires continuous beams of light.", "Numbers 20:28 — Moses put Aaron's garments upon Eleazar.", suppliedSprite(eleazarAsset, 42, 116, 30, 54, 42, { x: 75, y: 55 }), { cooldown: 3.0, range: 300, hitRadius: 10, moveSpeed: 80, attack: "beam" }),
};

export const ALLY_POOL: NpcId[] = Object.keys(ALLIES) as NpcId[];

export function allyDef(id: string): AllyDef | undefined {
  return (ALLIES as Record<string, AllyDef>)[id];
}

/** Seconds a fallen champion stays down before reviving. */
export const ALLY_REVIVE_SECONDS = 30;
/** How often a champion re-evaluates its nearest enemy. */
export const ALLY_RETARGET_SECONDS = 0.4;
/** Enemies inside this distance count as threats a champion retreats from. */
export const ALLY_THREAT_RADIUS = 240;

/** Champion summoning opportunities: every 15 levels (15, 30, 45, ...). */
export function isChampionLevel(level: number): boolean {
  return level % 15 === 0;
}
