// Allied champion registry. Every champion is data here; the common ally
// system in engine.ts (movement, targeting, HP, death/grave/revival, invocation,
// recruitment) and the shared renderer in allyArt.ts read from it. Adding a new
// champion = add an entry here (plus its sprite), nothing else.
import miriamAsset from "@/assets/ally-miriam.png.asset.json";
import miriamBodyAsset from "@/assets/ally-miriam-body.png.asset.json";
import miriamBroomAsset from "@/assets/ally-miriam-broom.png.asset.json";
import miriamHandAsset from "@/assets/ally-miriam-hand.png.asset.json";
import aaronAsset from "@/assets/ally-aaron.png.asset.json";
import jochebedAsset from "@/assets/ally-jochebed.png.asset.json";
import type { NpcId } from "./types";

export type AllyAttackKind = "broom" | "water" | "horn";

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
  /** fraction of the action phase at which the hit lands (default 0) */
  impactFrac?: number;
  /** every ordinary enemy struck is killed outright (bosses take staff damage) */
  instantKill?: boolean;
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

// Balance profiles:
//  Miriam   — glass cannon: low HP, instant-kill broom, fastest attacks.
//  Jochebed — tank: very high HP, low damage, moderate (not fast) attacks.
//  Aaron    — high HP and high damage, but a clearly longer cooldown.
export const ALLIES: Record<"miriam" | "jochebed" | "aaron", AllyDef> = {
  miriam: {
    id: "miriam",
    name: "Miriam",
    description: "Moses' sister. Fragile, but her broom strikes hard and often.",
    scripture: "Exodus 15:20 — Miriam the prophetess, the sister of Aaron, took a timbrel in her hand.",
    sprite: { url: miriamAsset.url, W: 44, H: 86, CX: 16, FOOT_TOP: 79, FOOT_X0: 6, FOOT_X1: 28, FOOT_SPLIT: 17, FX: { x: 37, y: 78 }, scale: 0.8 },
    weapon: {
      bodyUrl: miriamBodyAsset.url,
      weaponUrl: miriamBroomAsset.url,
      handUrl: miriamHandAsset.url,
      pivot: { x: 16, y: 29 },
      tip: { x: 37, y: 78 },
      swingAngle: -1.05,
      windupAngle: 0.35,
    },
    impactFrac: 0.35,
    instantKill: true,
    maxHp: 160,
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
    sprite: { url: jochebedAsset.url, W: 42, H: 82, CX: 14, FOOT_TOP: 77, FOOT_X0: 6, FOOT_X1: 25, FOOT_SPLIT: 15, FX: { x: 36, y: 48 } },
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
    sprite: { url: aaronAsset.url, W: 47, H: 88, CX: 16, FOOT_TOP: 80, FOOT_X0: 3, FOOT_X1: 30, FOOT_SPLIT: 15, FX: { x: 45, y: 6 } },
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
};

export const ALLY_POOL: NpcId[] = Object.keys(ALLIES) as NpcId[];

export function allyDef(id: string): AllyDef | undefined {
  return (ALLIES as Record<string, AllyDef>)[id];
}

/** Seconds a fallen champion stays down before reviving. */
export const ALLY_REVIVE_SECONDS = 30;
/** How often a champion re-evaluates its nearest enemy. */
export const ALLY_RETARGET_SECONDS = 0.5;
