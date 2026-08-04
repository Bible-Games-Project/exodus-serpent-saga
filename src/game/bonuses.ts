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

export function pushNotification(s: GameState, text: string, color: string) {
  const list = (s.notifications ??= []);
  s.nextNotifId = (s.nextNotifId ?? 0) + 1;
  list.push({ id: s.nextNotifId, text, color, born: s.now, ttl: 2.2 });
  // Keep notifications trimmed to avoid unbounded growth.
  if (list.length > 8) list.splice(0, list.length - 8);
}

export const BONUSES: Record<BonusKind, BonusDef> = {
  heart: {
    id: "heart",
    name: "Health",
    emoji: "❤",
    color: "#ff5060",
    duration: 0,
    weight: 3,
    apply: (s) => {
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 40);
      pushNotification(s, "+ Health", "#ff5060");
    },
  },
  magnet: {
    id: "magnet",
    name: "Magnet",
    emoji: "🧲",
    color: "#c04040",
    duration: 15,
    weight: 2,
    apply: (s) => {
      s.magnetBoostUntil = Math.max(s.magnetBoostUntil ?? 0, s.now + 15);
      pushNotification(s, "+ Magnet", "#c04040");
    },
  },
  star: {
    id: "star",
    name: "Invincible",
    emoji: "⭐",
    color: "#ffd54a",
    duration: 10,
    weight: 1,
    apply: (s) => {
      s.invulnUntil = Math.max(s.invulnUntil ?? 0, s.now + 10);
      pushNotification(s, "+ Invincible", "#ffd54a");
    },
  },
  lightning: {
    id: "lightning",
    name: "Speed",
    emoji: "⚡",
    color: "#7fd0ff",
    duration: 12,
    weight: 2,
    apply: (s) => {
      s.speedBoostUntil = Math.max(s.speedBoostUntil ?? 0, s.now + 12);
      pushNotification(s, "+ Speed", "#7fd0ff");
    },
  },
  shield: {
    id: "shield",
    name: "Shield",
    emoji: "🛡",
    color: "#8ec8ff",
    duration: 18,
    weight: 2,
    apply: (s) => {
      s.shieldUntil = Math.max(s.shieldUntil ?? 0, s.now + 18);
      pushNotification(s, "+ Shield", "#8ec8ff");
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

// Damage taken multiplier: permanent Shield of Faith blessing + temporary shield bonus.
export function shieldDamageMul(state: GameState): number {
  const passive = Math.min(0.5, 0.05 * (state.passives?.shield ?? 0));
  const temp = state.now < (state.shieldUntil ?? 0) ? 0.6 : 0;
  return 1 - Math.min(0.85, passive + temp);
}
