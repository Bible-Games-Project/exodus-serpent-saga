// Bonus drop system — modular, data-driven pickups that drop from slain enemies.
// Add a new bonus by adding an entry to BONUSES; the engine and renderer read
// this table so no other code has to change.
import type { GameState } from "./types";

export type BonusKind = "heart" | "magnet" | "star" | "lightning";

export type BonusDef = {
  id: BonusKind;
  name: string;
  emoji: string;      // fallback pictogram
  color: string;      // pill accent + particle color
  duration: number;   // seconds; 0 = instant effect
  dropChance: number; // per enemy killed
  apply: (state: GameState) => void;
};

export const BONUSES: Record<BonusKind, BonusDef> = {
  heart: {
    id: "heart",
    name: "Heart",
    emoji: "❤",
    color: "#ff5060",
    duration: 0,
    dropChance: 0.03,
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
    dropChance: 0.02,
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
    dropChance: 0.012,
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
    dropChance: 0.02,
    apply: (s) => {
      s.speedBoostUntil = Math.max(s.speedBoostUntil ?? 0, s.now + 6);
    },
  },
};

export const BONUS_ORDER: BonusKind[] = ["heart", "magnet", "star", "lightning"];

// Return a bonus kind to drop, or null. Called once per enemy death.
export function rollBonusDrop(): BonusKind | null {
  for (const id of BONUS_ORDER) {
    if (Math.random() < BONUSES[id].dropChance) return id;
  }
  return null;
}
