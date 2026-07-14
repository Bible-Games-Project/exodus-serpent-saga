// Modular enemy registry. Each entry defines stats + behaviour hook.
// New enemies can be added purely as data; engine dispatches by `behavior`.
import type { Entity, GameState, Vec2 } from "./types";

export type EnemyBehavior =
  | "chase"       // classic melee chase
  | "ranged"      // keep distance, shoot projectiles
  | "charge"      // periodic dash toward target
  | "erratic"     // jittery flying (bats)
  | "pack"        // wolves cluster with peers
  | "flyover";    // ignores obstacles

export type EnemyDef = {
  kind: string;
  category: "human" | "animal";
  radius: number;
  baseHp: number;
  hpPerMinute: number;
  speed: number;
  contactDmg: number;
  xp: number;
  minMinute: number; // earliest spawn time in survival minutes
  weight: number;    // relative spawn weight once eligible
  behavior: EnemyBehavior;
  ignoresObstacles?: boolean;
  attack?: {
    cooldown: number;
    range: number;
    projectileSpeed: number;
    projectileDmg: number;
    projectileKind: string; // rendered by GameCanvas
    projectileTtl: number;
  };
  // For charge behaviour
  chargeCooldown?: number;
  chargeSpeed?: number;
  chargeDuration?: number;
};

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  soldier: {
    kind: "soldier", category: "human",
    radius: 12, baseHp: 26, hpPerMinute: 24, speed: 55, contactDmg: 10, xp: 3,
    minMinute: 0, weight: 6, behavior: "chase",
  },
  jackal: {
    kind: "jackal", category: "animal",
    radius: 10, baseHp: 14, hpPerMinute: 14, speed: 95, contactDmg: 12, xp: 2,
    minMinute: 0.5, weight: 5, behavior: "chase",
  },
  swordsoldier: {
    kind: "swordsoldier", category: "human",
    radius: 12, baseHp: 42, hpPerMinute: 26, speed: 70, contactDmg: 14, xp: 4,
    minMinute: 1.2, weight: 4, behavior: "chase",
  },
  archer: {
    kind: "archer", category: "human",
    radius: 11, baseHp: 24, hpPerMinute: 18, speed: 45, contactDmg: 6, xp: 4,
    minMinute: 2, weight: 3, behavior: "ranged",
    attack: { cooldown: 2.2, range: 260, projectileSpeed: 320, projectileDmg: 10, projectileKind: "arrow", projectileTtl: 1.4 },
  },
  crow: {
    kind: "crow", category: "animal",
    radius: 8, baseHp: 10, hpPerMinute: 8, speed: 130, contactDmg: 6, xp: 2,
    minMinute: 1.5, weight: 3, behavior: "flyover", ignoresObstacles: true,
  },
  bat: {
    kind: "bat", category: "animal",
    radius: 7, baseHp: 8, hpPerMinute: 8, speed: 150, contactDmg: 8, xp: 2,
    minMinute: 2.5, weight: 3, behavior: "erratic", ignoresObstacles: true,
  },
  wolf: {
    kind: "wolf", category: "animal",
    radius: 11, baseHp: 30, hpPerMinute: 20, speed: 115, contactDmg: 14, xp: 4,
    minMinute: 3, weight: 4, behavior: "pack",
  },
  knight: {
    kind: "knight", category: "human",
    radius: 16, baseHp: 90, hpPerMinute: 40, speed: 65, contactDmg: 18, xp: 8,
    minMinute: 4, weight: 2, behavior: "ranged",
    attack: { cooldown: 2.6, range: 240, projectileSpeed: 300, projectileDmg: 14, projectileKind: "spear_e", projectileTtl: 1.4 },
  },
  chariot: {
    kind: "chariot", category: "human",
    radius: 18, baseHp: 120, hpPerMinute: 45, speed: 90, contactDmg: 22, xp: 10,
    minMinute: 5, weight: 2, behavior: "charge",
    chargeCooldown: 4, chargeSpeed: 260, chargeDuration: 0.9,
  },
  lion: {
    kind: "lion", category: "animal",
    radius: 14, baseHp: 90, hpPerMinute: 30, speed: 80, contactDmg: 20, xp: 6,
    minMinute: 5, weight: 2, behavior: "charge",
    chargeCooldown: 5, chargeSpeed: 280, chargeDuration: 0.8,
  },
  mage: {
    kind: "mage", category: "human",
    radius: 12, baseHp: 50, hpPerMinute: 22, speed: 40, contactDmg: 8, xp: 6,
    minMinute: 6, weight: 2, behavior: "ranged",
    attack: { cooldown: 2.4, range: 280, projectileSpeed: 240, projectileDmg: 16, projectileKind: "magebolt", projectileTtl: 1.8 },
  },
};

const ENEMY_ORDER = Object.keys(ENEMY_DEFS);

// Weighted random selection filtered by survival time.
export function pickEnemyKind(state: GameState): string {
  const mins = state.now / 60;
  const eligible = ENEMY_ORDER.filter((k) => ENEMY_DEFS[k].minMinute <= mins);
  const total = eligible.reduce((s, k) => s + ENEMY_DEFS[k].weight, 0);
  let r = Math.random() * total;
  for (const k of eligible) {
    r -= ENEMY_DEFS[k].weight;
    if (r <= 0) return k;
  }
  return "soldier";
}

// ----- behaviour tick helpers (called from engine) -----
const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function enemyTick(
  state: GameState,
  e: Entity,
  target: Vec2,
  dt: number,
  helpers: {
    baseSlow: number;
    resolveObstacles: (pos: Vec2, r: number) => void;
    spawnEnemyProjectile: (owner: Entity, dir: Vec2, kind: string, speed: number, dmg: number, ttl: number) => void;
  },
): void {
  const def = ENEMY_DEFS[e.kind];
  if (!def) return;
  const dx = target.x - e.pos.x;
  const dy = target.y - e.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  const frozen = state.now < ((e.data?.freezeUntil as number) ?? 0);
  const freezeMul = frozen ? 0.3 : 1;

  const move = (vx: number, vy: number) => {
    e.pos.x += vx * dt;
    e.pos.y += vy * dt;
    if (!def.ignoresObstacles) helpers.resolveObstacles(e.pos, e.radius);
  };

  const spd = def.speed * helpers.baseSlow * freezeMul;

  if (def.behavior === "chase" || def.behavior === "pack") {
    let mvx = nx, mvy = ny;
    if (def.behavior === "pack") {
      // slight cohesion toward other wolves
      let cx = 0, cy = 0, n = 0;
      for (const other of state.entities.values()) {
        if (other === e || other.kind !== e.kind) continue;
        const d2 = dist2(other.pos, e.pos);
        if (d2 < 40000) { cx += other.pos.x; cy += other.pos.y; n++; }
      }
      if (n > 0) {
        cx /= n; cy /= n;
        const bx = cx - e.pos.x, by = cy - e.pos.y;
        const bd = Math.hypot(bx, by) || 1;
        mvx = nx * 0.7 + (bx / bd) * 0.3;
        mvy = ny * 0.7 + (by / bd) * 0.3;
        const m = Math.hypot(mvx, mvy) || 1;
        mvx /= m; mvy /= m;
      }
    }
    move(mvx * spd, mvy * spd);
    // Melee swing anim for humans in close range.
    if (def.category === "human" && d < e.radius + 26) {
      const swingCd = ((e.data!.swingCd as number) ?? 0) - dt;
      if (swingCd <= 0) {
        e.data!.swingUntil = state.now + 0.28;
        e.data!.swingCd = 1.1;
      } else {
        e.data!.swingCd = swingCd;
      }
    }
  } else if (def.behavior === "flyover") {
    move(nx * spd, ny * spd);
    // gentle vertical bob
    e.pos.y += Math.sin(state.now * 4 + e.id) * 6 * dt;
  } else if (def.behavior === "erratic") {
    const d2 = e.data!;
    d2.jitterT = ((d2.jitterT as number) ?? 0) - dt;
    if ((d2.jitterT as number) <= 0) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 2.4;
      d2.jvx = Math.cos(a) * spd;
      d2.jvy = Math.sin(a) * spd;
      d2.jitterT = 0.2 + Math.random() * 0.25;
    }
    move((d2.jvx as number) ?? nx * spd, (d2.jvy as number) ?? ny * spd);
  } else if (def.behavior === "ranged") {
    const preferred = (def.attack?.range ?? 200) * 0.7;
    let mvx = nx, mvy = ny;
    if (d < preferred - 20) { mvx = -nx; mvy = -ny; }
    else if (d < preferred + 20) { mvx = -ny; mvy = nx; }
    move(mvx * spd, mvy * spd);
    const cd = ((e.data!.atkCd as number) ?? 0) - dt;
    // Trigger a short windup before firing.
    if (def.attack && d < def.attack.range && cd < 0.35 && cd > 0 && !(e.data!.windupUntil as number | undefined)) {
      e.data!.windupUntil = state.now + cd;
    }
    if (cd <= 0 && def.attack && d < def.attack.range) {
      helpers.spawnEnemyProjectile(e, { x: nx, y: ny }, def.attack.projectileKind, def.attack.projectileSpeed, def.attack.projectileDmg, def.attack.projectileTtl);
      e.data!.atkCd = def.attack.cooldown;
      e.data!.lastAtkAt = state.now;
      e.data!.windupUntil = 0;
    } else {
      e.data!.atkCd = cd;
    }
  } else if (def.behavior === "charge") {
    const d3 = e.data!;
    const chargingUntil = (d3.chargingUntil as number) ?? 0;
    const windupUntil = (d3.chargeWindupUntil as number) ?? 0;
    if (state.now < windupUntil) {
      // Anticipation — stand still and telegraph.
    } else if (state.now < chargingUntil) {
      const cvx = d3.chargeVx as number;
      const cvy = d3.chargeVy as number;
      move(cvx * freezeMul, cvy * freezeMul);
    } else {
      const cd = ((d3.chargeCd as number) ?? 0) - dt;
      if (cd <= 0 && d < 320) {
        d3.chargeVx = nx * (def.chargeSpeed ?? 240);
        d3.chargeVy = ny * (def.chargeSpeed ?? 240);
        d3.chargeWindupUntil = state.now + 0.45;
        d3.chargingUntil = state.now + 0.45 + (def.chargeDuration ?? 0.8);
        d3.chargeCd = def.chargeCooldown ?? 4;
      } else {
        d3.chargeCd = cd;
        move(nx * spd * 0.6, ny * spd * 0.6);
      }
    }
  }

  // facing
  if (e.kind === "jackal" || e.kind === "wolf" || e.kind === "lion") {
    e.facing = dx > 0 ? -1 : 1;
  } else {
    e.facing = dx > 0 ? 1 : -1;
  }
}

export function makeEnemy(state: GameState, kind: string, pos: Vec2): Entity {
  const def = ENEMY_DEFS[kind] ?? ENEMY_DEFS.soldier;
  const mins = state.now / 60;
  const hp = def.baseHp + def.hpPerMinute * mins;
  return {
    id: state.nextId++,
    pos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: 0 },
    radius: def.radius,
    hp, maxHp: hp,
    team: "enemy",
    facing: 1,
    animT: Math.random() * 10,
    born: state.now,
    kind,
    data: {
      speed: def.speed,
      contactDmg: def.contactDmg,
      xp: def.xp,
      category: def.category,
      atkCd: def.attack ? Math.random() * def.attack.cooldown : 0,
      chargeCd: def.chargeCooldown ?? 0,
    },
  };
}
