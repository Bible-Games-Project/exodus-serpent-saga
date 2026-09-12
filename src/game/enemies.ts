// Modular enemy registry. Each entry defines stats + behaviour hook.
// New enemies can be added purely as data; engine dispatches by `behavior`.
import type { Entity, GameState, Vec2 } from "./types";
import { ARCHER_SHOOT_DUR } from "./archerArt";
import { SPEAR_THROW_DUR } from "./spearSoldierArt";


export type EnemyBehavior =
  | "chase"       // classic melee chase
  | "ranged"      // keep distance, shoot projectiles
  | "charge"      // periodic dash toward target
  | "erratic"     // jittery flying (bats)
  | "pack"        // wolves cluster with peers
  | "ambush"      // waits motionless, then sprints once the target is close
  | "skirmish"    // erratic hops, dash in, hit, dash out
  | "flyover"     // ignores obstacles
  | "neutral";    // peaceful wanderer, never chases or attacks


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
  // Roster is deliberately limited to the three basic foes (plus Ramses, who
  // lives outside this table). More types will be added one by one later.
  soldier: {
    kind: "soldier", category: "human",
    radius: 12, baseHp: 26, hpPerMinute: 24, speed: 55, contactDmg: 10, xp: 3,
    minMinute: 0, weight: 6, behavior: "chase",
  },
  jackal: {
    kind: "jackal", category: "animal",
    radius: 10, baseHp: 14, hpPerMinute: 14, speed: 95, contactDmg: 12, xp: 2,
    minMinute: 1.5, weight: 5, behavior: "chase",
  },
  archer: {
    kind: "archer", category: "human",
    radius: 12, baseHp: 30, hpPerMinute: 22, speed: 50, contactDmg: 8, xp: 4,
    minMinute: 0, weight: 4, behavior: "ranged",
    attack: {
      cooldown: 2.4, range: 330, projectileSpeed: 270,
      projectileDmg: 9, projectileKind: "arrow", projectileTtl: 2.4,
    },
  },
  axesoldier: {
    kind: "axesoldier", category: "human",
    // Exactly twice the basic soldier's staff damage (10 -> 20).
    radius: 13, baseHp: 40, hpPerMinute: 26, speed: 52, contactDmg: 20, xp: 5,
    minMinute: 0, weight: 4, behavior: "chase",
  },
  shieldsoldier: {
    kind: "shieldsoldier", category: "human",
    // Purely defensive: he closes in but never attacks (contactDmg 0).
    radius: 14, baseHp: 60, hpPerMinute: 30, speed: 46, contactDmg: 0, xp: 5,
    minMinute: 0, weight: 3, behavior: "chase",
  },
  bat: {
    kind: "bat", category: "animal",
    // Glass cannon: one hit always kills it, but it flies at twice the dog's
    // speed (95 -> 190) and straight through every obstacle.
    radius: 9, baseHp: 1, hpPerMinute: 0, speed: 190, contactDmg: 6, xp: 2,
    minMinute: 0, weight: 4, behavior: "flyover", ignoresObstacles: true,
  },
  heavysoldier: {
    kind: "heavysoldier", category: "human",
    // Half the basic soldier's speed (55 -> 27.5), four times his damage
    // (10 -> 40, i.e. twice the axe soldier's 20) and ten times his health
    // (26 base / 24 per minute -> 260 / 240).
    radius: 15, baseHp: 260, hpPerMinute: 240, speed: 27.5, contactDmg: 40, xp: 8,
    minMinute: 0, weight: 3, behavior: "chase",
  },
  wolf: {
    kind: "wolf", category: "animal",
    // Lies in wait, then sprints at 80% of the bat's speed (190 -> 152), which
    // is 1.6x the dog's 95.
    radius: 12, baseHp: 34, hpPerMinute: 20, speed: 152, contactDmg: 16, xp: 4,
    minMinute: 0, weight: 4, behavior: "ambush",
  },
  agilesoldier: {
    kind: "agilesoldier", category: "human",
    // The heavy soldier's opposite: paper-thin, very fast, damage barely above
    // the basic soldier's 10.
    radius: 11, baseHp: 14, hpPerMinute: 9, speed: 165, contactDmg: 12, xp: 5,
    minMinute: 0, weight: 4, behavior: "skirmish",
  },
  cobra: {
    kind: "cobra", category: "animal",
    // Ordinary approach, but its bite poisons for 5 seconds.
    radius: 11, baseHp: 30, hpPerMinute: 20, speed: 62, contactDmg: 4, xp: 5,
    minMinute: 0, weight: 3, behavior: "chase",
  },
  spearsoldier: {
    kind: "spearsoldier", category: "human",
    // Behaves like the archer, but hurls spears instead of loosing arrows.
    radius: 12, baseHp: 34, hpPerMinute: 24, speed: 50, contactDmg: 10, xp: 6,
    minMinute: 0, weight: 4, behavior: "ranged",
    attack: {
      cooldown: 2.8, range: 320, projectileSpeed: 240,
      projectileDmg: 14, projectileKind: "spear_e", projectileTtl: 2.4,
    },
  },
  camel: {
    kind: "camel", category: "animal",
    // Completely neutral: wanders the desert, never attacks, and lends nearby
    // Egyptian soldiers a +10% movement-speed aura.
    radius: 16, baseHp: 70, hpPerMinute: 30, speed: 34, contactDmg: 0, xp: 4,
    minMinute: 0, weight: 2, behavior: "neutral",
  },
};

// Introduction order. Exactly ONE new enemy type unlocks every 3 player levels.
export const ENEMY_ORDER = [
  "soldier",
  "jackal",
  "archer",
  "axesoldier",
  "shieldsoldier",
  "bat",
  "heavysoldier",
  "wolf",
  "agilesoldier",
  "cobra",
  "spearsoldier",
  "camel",
];

/** Display names for menus. Unknown kinds fall back to a prettified key. */
const ENEMY_LABELS: Record<string, string> = {
  soldier: "Egyptian Soldier",
  jackal: "Desert Dog",
  archer: "Egyptian Archer",
  axesoldier: "Axe Soldier",
  shieldsoldier: "Shield Soldier",
  bat: "Desert Bat",
  heavysoldier: "Heavy Soldier",
  wolf: "Desert Wolf",
  agilesoldier: "Agile Soldier",
  cobra: "Cobra",
  spearsoldier: "Spear Soldier",
  camel: "Camel",
};

export function enemyLabel(kind: string): string {
  return ENEMY_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}






/** Player level at which an enemy type is first allowed to spawn. */
export function enemyUnlockLevel(kind: string): number {
  const i = ENEMY_ORDER.indexOf(kind);
  return i < 0 ? 0 : i * 3;
}

// Weighted random selection filtered by player level (one new type / 3 levels).
function camelAllowed(state: GameState): boolean {
  const st = state as unknown as { __camelLevel?: number };
  if (st.__camelLevel === state.level) return false;
  for (const e of state.entities.values()) if (e.kind === "camel") return false;
  return true;
}

export function pickEnemyKind(state: GameState): string {
  // In the Test Map the session config decides what may spawn; the normal game
  // keeps its untouched level-based unlock rule.
  const tm = state.testMap;
  const allowed = (k: string) =>
    (tm ? tm.enemies[k] === true : enemyUnlockLevel(k) <= state.level)
    && (k !== "camel" || camelAllowed(state));
  const eligible = ENEMY_ORDER.filter(allowed);
  if (eligible.length === 0) return "";
  const total = eligible.reduce((s, k) => s + ENEMY_DEFS[k].weight, 0);
  let r = Math.random() * total;
  for (const k of eligible) {
    r -= ENEMY_DEFS[k].weight;
    if (r <= 0) return k;
  }
  return eligible[0];

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

  // Camel aura: nearby Egyptian soldiers move 10% faster for a short while.
  const aura = def.category === "human" && state.now < ((e.data?.auraUntil as number) ?? 0) ? 1.1 : 1;
  const spd = def.speed * helpers.baseSlow * freezeMul * aura;

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
    // Stop just beside the target so the melee animation can reach it without
    // the sprites overlapping.
    const standoff = e.radius + 36;
    // The heavy soldier plants his boots for the whole sword swing; the cobra
    // anchors its coil while it strikes.
    const planted = (e.kind === "heavysoldier" && e.data?.heavyAt != null)
      || (e.kind === "cobra" && e.data?.strikeAt != null);

    if (d > standoff && !planted) move(mvx * spd, mvy * spd);

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
  } else if (def.behavior === "ambush") {
    // Waits in place like a wild animal until the target strays close enough,
    // then commits and sprints straight at him for good.
    const dw = e.data!;
    const TRIGGER = 260;
    if (!dw.awake && d < TRIGGER) dw.awake = 1;
    if (dw.awake) {
      // Plant the paws for the whole leap animation.
      const leaping = dw.leapAt != null;
      const standoff = e.radius + 26;
      if (!leaping && d > standoff) move(nx * spd, ny * spd);
    }
  } else if (def.behavior === "skirmish") {
    // Agile soldier: unpredictable short hops, a fast run-in when the target is
    // near, then an immediate fast retreat after the stab.
    const ds = e.data!;
    if (ds.stabAt != null) {
      ds.pendingRetreat = 1;
      ds.dashing = 1;
    } else if (ds.pendingRetreat) {
      ds.pendingRetreat = 0;
      ds.retreatUntil = state.now + 0.75;
    }
    const retreating = state.now < ((ds.retreatUntil as number) ?? 0);
    const standoff = e.radius + 34;

    if (ds.stabAt != null) {
      // Plant during the stab so the blow reads as contact, not a slide.
      ds.dashing = 1;
    } else if (retreating) {
      ds.dashing = 1;
      move(-nx * spd * 1.15, -ny * spd * 1.15);
    } else if (d < 210) {
      ds.dashing = 1;
      if (d > standoff) move(nx * spd * 1.3, ny * spd * 1.3);
    } else {
      ds.dashing = 0;
      // Wander in short springy hops toward no particular place.
      const hopAt = (ds.hopAt as number) ?? -1;
      const elapsed = state.now - hopAt;
      if (hopAt < 0 || elapsed > ((ds.hopGap as number) ?? 0.6)) {
        const bias = Math.atan2(ny, nx);
        const a = Math.random() < 0.45
          ? bias + (Math.random() - 0.5) * 1.6
          : Math.random() * Math.PI * 2;
        ds.hopAt = state.now;
        ds.hopGap = 0.5 + Math.random() * 0.35;
        ds.hvx = Math.cos(a) * spd * 1.1;
        ds.hvy = Math.sin(a) * spd * 1.1;
      } else if (elapsed < 0.34) {
        move((ds.hvx as number) ?? 0, (ds.hvy as number) ?? 0);
      }
    }
  } else if (def.behavior === "neutral") {
    // Peaceful desert wanderer: picks a random heading, strolls, pauses, repeats.
    const dn = e.data!;
    const until = (dn.wanderUntil as number) ?? 0;
    if (state.now >= until) {
      const walking = !dn.wanderWalk;
      dn.wanderWalk = walking ? 1 : 0;
      dn.wanderUntil = state.now + (walking ? 1.4 + Math.random() * 2.2 : 0.8 + Math.random() * 1.6);
      if (walking) {
        const a = Math.random() * Math.PI * 2;
        dn.wvx = Math.cos(a) * spd;
        dn.wvy = Math.sin(a) * spd;
      }
    }
    if (dn.wanderWalk) {
      const wvx = (dn.wvx as number) ?? 0;
      const wvy = (dn.wvy as number) ?? 0;
      move(wvx, wvy);
      e.facing = wvx > 0 ? 1 : -1;
    }
    // Grant the speed aura to soldiers standing close by.
    for (const other of state.entities.values()) {
      if (other === e || other.team !== "enemy") continue;
      if (ENEMY_DEFS[other.kind]?.category !== "human") continue;
      if (dist2(other.pos, e.pos) < 200 * 200) {
        if (other.data) other.data.auraUntil = state.now + 0.35;
      }
    }
    return;
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
    // Plant himself while the aim/shoot animation is playing: no sliding.
    const shootUntil = (e.data!.shootHoldUntil as number) ?? 0;
    if (state.now >= shootUntil) move(mvx * spd, mvy * spd);

    const cd = ((e.data!.atkCd as number) ?? 0) - dt;
    // Trigger a short windup before firing (the archer draws his bow here).
    if (def.attack && d < def.attack.range && cd < 0.35 && cd > 0 && !(e.data!.windupUntil as number | undefined)) {
      e.data!.windupUntil = state.now + cd;
      e.data!.shootAt = state.now;
      e.data!.shootHoldUntil = state.now + (e.kind === "spearsoldier" ? SPEAR_THROW_DUR : ARCHER_SHOOT_DUR);
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
  if (e.kind === "jackal" || e.kind === "lion") {
    e.facing = dx > 0 ? -1 : 1;
  } else {
    e.facing = dx > 0 ? 1 : -1;
  }
}

export function makeEnemy(state: GameState, kind: string, pos: Vec2): Entity {
  const def = ENEMY_DEFS[kind] ?? ENEMY_DEFS.soldier;
  if (kind === "camel") (state as unknown as { __camelLevel?: number }).__camelLevel = state.level;
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
