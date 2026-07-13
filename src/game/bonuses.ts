// Bonus system — modular, data-driven pickups that appear randomly in the world
// (no longer dropped by enemies). Add a new bonus by adding an entry to BONUSES.
import type { GameState } from "./types";

export type BonusKind = "heart" | "magnet" | "star" | "lightning" | "shield";

export type BonusDef = {
  id: BonusKind;
  name: string;
  emoji: string;      // fallback pictogram
  color: string;      // pill accent + particle color
  duration: number;   // seconds; 0 = instant effect
  weight: number;     // relative spawn weight
  apply: (state: GameState) => void;
};

export const BONUSES: Record<BonusKind, BonusDef> = {
  heart: {
    id: "heart",
    name: "Heart",
    emoji: "❤",
    color: "#ff5060",
    duration: 0,
    weight: 3,
    apply: (s) => {
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 30);
    },
  },
  magnet: {
    id: "magnet",
    name: "Magnet",
    emoji: "🧲",
    color: "#c04040",
    duration: 8,
    weight: 2,
    apply: (s) => {
      s.magnetBoostUntil = Math.max(s.magnetBoostUntil ?? 0, s.now + 8);
    },
  },
  star: {
    id: "star",
    name: "Star",
    emoji: "⭐",
    color: "#ffd54a",
    duration: 5,
    weight: 1,
    apply: (s) => {
      s.invulnUntil = Math.max(s.invulnUntil ?? 0, s.now + 5);
    },
  },
  lightning: {
    id: "lightning",
    name: "Lightning",
    emoji: "⚡",
    color: "#7fd0ff",
    duration: 6,
    weight: 2,
    apply: (s) => {
      s.speedBoostUntil = Math.max(s.speedBoostUntil ?? 0, s.now + 6);
    },
  },
  shield: {
    id: "shield",
    name: "Shield of Faith",
    emoji: "🛡",
    color: "#8ec8ff",
    duration: 10,
    weight: 2,
    apply: (s) => {
      s.shieldUntil = Math.max(s.shieldUntil ?? 0, s.now + 10);
    },
  },
};

export const BONUS_ORDER: BonusKind[] = ["heart", "magnet", "star", "lightning", "shield"];

// Pick a random bonus kind weighted by their weights.
export function rollBonusKind(): BonusKind {
  const total = BONUS_ORDER.reduce((a, k) => a + BONUSES[k].weight, 0);
  let r = Math.random() * total;
  for (const k of BONUS_ORDER) {
    r -= BONUSES[k].weight;
    if (r <= 0) return k;
  }
  return "heart";
}

// Damage taken multiplier when shield is active.
export function shieldDamageMul(state: GameState): number {
  return state.now < (state.shieldUntil ?? 0) ? 0.4 : 1;
}
