// Passive upgrade pool — offered as blessing cards between plague and
// companion picks. Data-driven and easy to extend.
import type { GameState } from "./types";

export type PassiveId = "maxHp" | "speed" | "damage" | "magnet" | "shield";

export type PassiveDef = {
  id: PassiveId;
  title: string;
  description: string;
  maxRank: number;
  apply: (state: GameState) => void;
};

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  maxHp: {
    id: "maxHp",
    title: "Manna from Heaven",
    description: "+20 max HP and instant heal.",
    maxRank: 8,
    apply: (s) => {
      const p = (s.passives ??= {});
      p.maxHp = (p.maxHp ?? 0) + 1;
      s.player.maxHp += 20;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 20);
    },
  },
  speed: {
    id: "speed",
    title: "Sandals of Haste",
    description: "+8% movement speed.",
    maxRank: 6,
    apply: (s) => {
      const p = (s.passives ??= {});
      p.speed = (p.speed ?? 0) + 1;
    },
  },
  damage: {
    id: "damage",
    title: "Wrath of the LORD",
    description: "+10% damage from all plagues.",
    maxRank: 8,
    apply: (s) => {
      const p = (s.passives ??= {});
      p.damage = (p.damage ?? 0) + 1;
    },
  },
  magnet: {
    id: "magnet",
    title: "Voice that Calls",
    description: "+25% XP and coin pickup radius.",
    maxRank: 6,
    apply: (s) => {
      const p = (s.passives ??= {});
      p.magnet = (p.magnet ?? 0) + 1;
    },
  },
};

export const PASSIVE_ORDER: PassiveId[] = ["maxHp", "speed", "damage", "magnet"];

export function passiveRank(state: GameState, id: PassiveId): number {
  return state.passives?.[id] ?? 0;
}

export function speedMultiplier(state: GameState): number {
  return 1 + 0.08 * passiveRank(state, "speed") + (state.now < (state.speedBoostUntil ?? 0) ? 0.5 : 0);
}
export function damageMultiplier(state: GameState): number {
  return 1 + 0.1 * passiveRank(state, "damage");
}
export function magnetMultiplier(state: GameState): number {
  return 1 + 0.25 * passiveRank(state, "magnet") + (state.now < (state.magnetBoostUntil ?? 0) ? 2.5 : 0);
}

// Permanent shield damage reduction from the "Shield of Faith" blessing.
export function shieldPassiveReduction(state: GameState): number {
  return Math.min(0.5, 0.05 * passiveRank(state, "shield"));
}

// Melee strength of Moses' staff strike — plague level scaling × damage passives.
export function meleeMultiplier(state: GameState, staffLevel: number): number {
  return (1 + 0.3125 * (staffLevel - 1)) * damageMultiplier(state);
}
