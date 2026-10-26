// Shop weapons: per-weapon combat behavior layered on the basic attack.
// Combat cadence is unchanged; equipmentArt handles per-item visual gestures.
// Each weapon adds its own established projectiles, hazards and on-hit effects.
import type { Entity, GameState, Vec2 } from "./types";
import { weaponDamage } from "./loadout";

export type WeaponId = "branch" | "dagger" | "spear" | "sword" | "harpoon" | "axe" | "boomerang" | "mace" | "ring";

export function equippedWeapon(state: GameState): { id: WeaponId; evo: number } {
  const lo = state.loadout;
  return { id: (lo?.weapon.id ?? "branch") as WeaponId, evo: lo?.weapon.evolution ?? 1 };
}

/** Base physical damage of one weapon hit (already includes passives). */
export function weaponHitDamage(state: GameState, base: number): number {
  return base * (weaponDamage(state) / 0.5);
}

// ---------------------------------------------------------------- tuning
/** Weapons that only throw projectiles and never perform the melee swing. */
export function weaponIsRangedOnly(id: string): boolean {
  return id === "boomerang" || id === "ring" || id === "harpoon";
}
/** Attack cooldown multiplier (lower = faster). Only the dagger is faster. */
export function weaponCooldownMul(state: GameState): number {
  const { id, evo } = equippedWeapon(state);
  return id === "dagger" ? [0.7, 0.58, 0.46][evo - 1] ?? 0.7 : 1;
}
/** Melee swing duration multiplier for the attack animation. */
export function weaponSwingDurMul(state: GameState): number {
  const { id, evo } = equippedWeapon(state);
  return id === "dagger" ? [0.75, 0.66, 0.58][evo - 1] ?? 0.75 : 1;
}
/** Melee reach multiplier: longer swords and bigger dagger cones by level. */
export function weaponReachMul(state: GameState): number {
  const { id, evo } = equippedWeapon(state);
  if (id === "sword") return [1, 1.5, 2][evo - 1] ?? 1;
  if (id === "dagger") return [1, 1.35, 1.75][evo - 1] ?? 1;
  if (id === "spear") return 1.45;
  return 1;
}
/** Melee knockback in px. */
export function weaponKnockback(state: GameState): number {
  const { id, evo } = equippedWeapon(state);
  if (id === "sword") return 10 * ([1, 1.6, 2.2][evo - 1] ?? 1);
  if (id === "spear") return evo >= 2 ? 22 : 14;
  return 10;
}
/** Dagger poison: always present, chance and strength grow with level. */
export const DAGGER_POISON = [
  { chance: 0.4, dps: 4, dur: 5 },
  { chance: 0.65, dps: 6, dur: 7 },
  { chance: 0.9, dps: 9, dur: 8 },
] as const;
/** Ring rebounds per level. */
export const RING_BOUNCES = [4, 8, 12] as const;
/** Harpoon whirlpool proc chance per level (none at level 1). */
export const HARPOON_WHIRL_CHANCE = [0, 0.2, 0.3] as const;

/** Nearest enemy direction from Moses; falls back to the last movement direction. */
export function aimDir(state: GameState): Vec2 {
  const p = state.player;
  let best: Entity | null = null, bd = Infinity;
  for (const en of state.entities.values()) {
    if (en.team !== "enemy") continue;
    const dx = wrapD(en.pos.x, p.pos.x, state.worldW), dy = wrapD(en.pos.y, p.pos.y, state.worldH);
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = en; }
  }
  if (!best) return lastMoveDir(state);
  const dx = wrapD(best.pos.x, p.pos.x, state.worldW), dy = wrapD(best.pos.y, p.pos.y, state.worldH);
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}
function wrapD(a: number, b: number, size: number): number {
  let d = a - b;
  if (d > size / 2) d -= size; else if (d < -size / 2) d += size;
  return d;
}

// ---------------------------------------------------------------- cast
// Called when the basic attack fires. Spawns the weapon's extra entities.
export function weaponOnCast(
  state: GameState,
  spawn: (kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>, team?: Entity["team"]) => Entity,
): void {
  const { id, evo } = equippedWeapon(state);
  (state.equipFx ??= {}).weaponVisualAt = state.now;
  const p = state.player;
  const dir: Vec2 = aimDir(state);
  const dmg = weaponHitDamage(state, 14);
  const ang = Math.atan2(dir.y, dir.x);

  switch (id) {
    case "spear": {
      // Melee only: a horizontal piercing thrust FX in front of Moses.
      spawn("spearthrust", { ...p.pos }, 0.22, { facing: p.facing, len: 70 * weaponReachMul(state), evo }, "hazard");
      break;
    }
    case "dagger": {
      // Extra phantom daggers stab ahead from level 2 (visual multi-attack).
      const n = evo === 3 ? 5 : evo === 2 ? 3 : 0;
      for (let i = 0; i < n; i++) {
        spawn("daggerstab", { ...p.pos }, 0.3, { facing: p.facing, delay: i * 0.045, row: i - (n - 1) / 2, reach: 34 * weaponReachMul(state) }, "hazard");
      }
      break;
    }
    case "harpoon": {
      const proc = Math.random() < (HARPOON_WHIRL_CHANCE[evo - 1] ?? 0);
      spawn("wpnproj", { ...p.pos }, 1.4, {
        vx: dir.x * 400, vy: dir.y * 400, dmg,
        pierce: evo >= 2 ? 3 : 1, knock: 16,
        whirlpool: proc ? (evo >= 3 ? 1.3 : 1) : 0, art: "harpoon",
      }, "projectile");
      break;
    }
    case "boomerang": {
      const n = evo; // 1/2/3 independent returning projectiles
      for (let i = 0; i < n; i++) {
        const a = ang + (i - (n - 1) / 2) * 0.5;
        spawn("wpboom", { ...p.pos }, 2.2, {
          vx: Math.cos(a) * 320, vy: Math.sin(a) * 320,
          dmg, phase: 0, flash: evo >= 3 ? 1 : 0,
        }, "projectile");
      }
      break;
    }
    case "ring": {
      spawn("wpring", { ...p.pos }, 4.0, {
        vx: dir.x * 380, vy: dir.y * 380, dmg,
        bounces: RING_BOUNCES[evo - 1] ?? 4, returning: 0, knock: 12,
        electric: evo >= 3 ? 1 : 0,
      }, "projectile");
      break;
    }
    case "axe": {
      // Ground cut toward the nearest enemy (never behind Moses by accident).
      const len = evo >= 3 ? 260 : evo >= 2 ? 200 : 150;
      const wid = evo >= 3 ? 46 : evo >= 2 ? 34 : 22;
      spawn("axeline", { x: p.pos.x + dir.x * len * 0.5, y: p.pos.y + dir.y * len * 0.5 }, 0.45, {
        dmg, len, wid, angle: ang,
        slow: evo >= 2 ? 2 : 0, cracks: evo >= 3 ? 1 : 0, hit: [],
      }, "hazard");
      break;
    }
    case "mace": {
      const reach = 64;
      const r = evo >= 3 ? 90 : evo >= 2 ? 70 : 48;
      spawn("maceimpact", { x: p.pos.x + dir.x * reach, y: p.pos.y + dir.y * reach }, 0.4, {
        dmg, r, second: evo >= 3 ? 1 : 0, hit: [],
      }, "hazard");
      break;
    }
    case "branch": {
      if (evo >= 3) spawn("shockwave", { ...p.pos }, 0.35, { dmg: dmg * 0.5, r: 90, hit: [] }, "hazard");
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- melee hits
// Called for every enemy hit by the basic melee swing.
export function weaponOnMeleeHit(state: GameState, en: Entity): void {
  const { id, evo } = equippedWeapon(state);
  en.data ??= {};
  switch (id) {
    case "dagger": {
      const pz = DAGGER_POISON[evo - 1] ?? DAGGER_POISON[0];
      if (Math.random() >= pz.chance) break;
      en.data.poisonUntil = state.now + pz.dur;
      en.data.poisonDps = weaponHitDamage(state, pz.dps);
      en.data.poisonSpread = evo >= 2 ? 1 : 0;
      en.data.poisonCloud = evo >= 3 ? 1 : 0;
      break;
    }
    case "sword": {
      const d = (state.player.data ??= {});
      d.atkCount = ((d.atkCount as number) ?? 0) + 1;
      const every = evo >= 2 ? 8 : 10;
      if ((d.atkCount as number) % every === 0) {
        en.hp -= weaponHitDamage(state, 20); // critical hit
      }
      if (evo >= 3) en.data.burnUntil = state.now + 2;
      break;
    }
    case "branch": {
      if (evo >= 2) {
        const kx = en.pos.x - state.player.pos.x, ky = en.pos.y - state.player.pos.y;
        const kd = Math.hypot(kx, ky) || 1;
        en.pos.x += (kx / kd) * 14;
        en.pos.y += (ky / kd) * 14;
      }
      break;
    }
    default:
      break;
  }
}

/** Poison / burn damage over time, applied each frame from the engine. */
export function weaponDot(state: GameState, en: Entity, dt: number): void {
  const d = en.data;
  if (!d) return;
  if ((d.poisonUntil as number) > state.now) {
    en.hp -= ((d.poisonDps as number) ?? 0) * dt;
  }
  if ((d.burnUntil as number) > state.now) {
    en.hp -= weaponHitDamage(state, 3) * dt;
  }
}

/** Poison spreads / leaves a toxic cloud when a poisoned enemy dies. */
export function weaponOnEnemyDeath(
  state: GameState,
  en: Entity,
  spawn: (kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>, team?: Entity["team"]) => Entity,
  wrapDist2: (a: Vec2, b: Vec2) => number,
): void {
  const d = en.data;
  if (!d || !((d.poisonUntil as number) > 0)) return;
  if (d.poisonSpread) {
    for (const o of state.entities.values()) {
      if (o.team !== "enemy" || o.id === en.id) continue;
      if (wrapDist2(o.pos, en.pos) < 70 * 70) {
        o.data ??= {};
        o.data.poisonUntil = state.now + 5;
        o.data.poisonDps = d.poisonDps;
      }
    }
  }
  if (d.poisonCloud) {
    spawn("toxiccloud", { ...en.pos }, 3, { dps: (d.poisonDps as number) ?? 4, r: 60 }, "hazard");
  }
}

// ---------------------------------------------------------------- update
// Per-frame movement and collision of weapon projectiles and hazards.
export function updateWeaponEntities(
  state: GameState,
  dt: number,
  ctx: {
    wrapDelta: (a: number, b: number, size: number) => number;
    killEnemy: (en: Entity) => void;
    block?: (shield: Entity, source: Vec2) => void;
    spawn: (kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>, team?: Entity["team"]) => Entity;
  },
): void {
  const p = state.player;
  for (const e of [...state.entities.values()]) {
    const d = e.data;
    if (!d) continue;

    if (e.kind === "wpnproj" || e.kind === "wpboom" || e.kind === "wpring" || e.kind === "staffflame") {
      if (e.kind === "staffflame" && d.pierce == null) d.pierce = 1;
      // Boomerang: outbound then return to Moses.
      if (e.kind === "wpboom") {
        const elapsed = (e as Entity & { maxTtl?: number }).ttl ?? 0;
        if (d.phase === 0 && (e.ttl ?? 0) < 1.1) d.phase = 1;
        if (d.phase === 1) {
          const dx = p.pos.x - e.pos.x, dy = p.pos.y - e.pos.y;
          const dd = Math.hypot(dx, dy) || 1;
          d.vx = (dx / dd) * 380;
          d.vy = (dy / dd) * 380;
          if (dd < 20) { e.ttl = 0; continue; }
        }
      }
      // Ring: rebounds between enemies, then returns at lightning speed.
      if (e.kind === "wpring" && d.returning) {
        const dx = p.pos.x - e.pos.x, dy = p.pos.y - e.pos.y;
        const dd = Math.hypot(dx, dy) || 1;
        const spd = d.electric ? 700 : 420;
        d.vx = (dx / dd) * spd;
        d.vy = (dy / dd) * spd;
        if (dd < 20) { e.ttl = 0; continue; }
      }
      e.pos.x += (d.vx as number) * dt;
      e.pos.y += (d.vy as number) * dt;

      const hitSet = (d.hit ??= new Set<number>()) as Set<number>;
      for (const en of state.entities.values()) {
        if (en.team !== "enemy" || hitSet.has(en.id)) continue;
        const rx = ctx.wrapDelta(en.pos.x, e.pos.x, state.worldW);
        const ry = ctx.wrapDelta(en.pos.y, e.pos.y, state.worldH);
        if (Math.hypot(rx, ry) > en.radius + 10) continue;
        hitSet.add(en.id);
        // Shield soldiers stop thrown weapons: they bounce back to Moses.
        if (en.kind === "shieldsoldier" && e.kind !== "staffflame") {
          ctx.block?.(en, e.pos);
          if (e.kind === "wpboom") d.phase = 1;
          else if (e.kind === "wpring") d.returning = 1;
          else e.ttl = 0;
          break;
        }
        let dmg = d.dmg as number;
        // Celestial Ring: double damage on the return trip.
        if (e.kind === "wpring" && d.returning && d.electric) dmg *= 2;
        en.hp -= dmg;
        if (d.knock) {
          const kd = Math.hypot(rx, ry) || 1;
          en.pos.x += (rx / kd) * (d.knock as number);
          en.pos.y += (ry / kd) * (d.knock as number);
        }
        if (d.whirlpool) {
          ctx.spawn("whirlpool", { ...en.pos }, 1.6, {
            dps: dmg * 0.25, r: 60 * (d.whirlpool as number), slow: (d.whirlpool as number) >= 1.6 ? 1 : 0,
          }, "hazard");
        }
        if (d.whirlpool) d.whirlpool = 0; // one whirlpool per throw
        if (d.burn) { en.data ??= {}; en.data.burnUntil = state.now + 2; }
        if (en.hp <= 0) ctx.killEnemy(en);
        // Pierce / rebound bookkeeping.
        if (e.kind === "wpnproj" || e.kind === "staffflame") {
          d.pierce = (d.pierce as number) - 1;
          if ((d.pierce as number) <= 0) { e.ttl = 0; break; }
        } else if (e.kind === "wpring" && !d.returning) {
          d.bounces = (d.bounces as number) - 1;
          if ((d.bounces as number) <= 0) {
            d.returning = 1;
          } else {
            // Rebound toward the nearest other enemy.
            let best: Entity | null = null, bd = Infinity;
            for (const o of state.entities.values()) {
              if (o.team !== "enemy" || hitSet.has(o.id)) continue;
              const dd2 = ctx.wrapDelta(o.pos.x, en.pos.x, state.worldW) ** 2 + ctx.wrapDelta(o.pos.y, en.pos.y, state.worldH) ** 2;
              if (dd2 < bd) { bd = dd2; best = o; }
            }
            if (best) {
              const dx = ctx.wrapDelta(best.pos.x, e.pos.x, state.worldW);
              const dy = ctx.wrapDelta(best.pos.y, e.pos.y, state.worldH);
              const dd = Math.hypot(dx, dy) || 1;
              d.vx = (dx / dd) * 360;
              d.vy = (dy / dd) * 360;
            } else {
              d.returning = 1;
            }
          }
        }
      }
      continue;
    }

    // Damaging ground hazards: axeline, maceimpact, shockwave, whirlpool, toxiccloud.
    if (["axeline", "maceimpact", "shockwave", "whirlpool", "toxiccloud", "firering", "slowwave", "windtrail", "slowprint"].includes(e.kind)) {
      const hitArr = (d.hit ??= []) as number[];
      const isDot = e.kind === "whirlpool" || e.kind === "toxiccloud" || e.kind === "windtrail" || e.kind === "slowprint";
      if (e.kind === "firering" && d.burn) d.burnHit = 1;
      for (const en of state.entities.values()) {
        if (en.team !== "enemy") continue;
        let inside = false;
        if (e.kind === "axeline") {
          // Point-to-segment along the cutting line.
          const len = d.len as number, ang = d.angle as number;
          const hx = Math.cos(ang) * len * 0.5, hy = Math.sin(ang) * len * 0.5;
          const x0 = e.pos.x - hx, y0 = e.pos.y - hy;
          const vx = hx * 2, vy = hy * 2;
          const wx = en.pos.x - x0, wy = en.pos.y - y0;
          let t = (wx * vx + wy * vy) / (vx * vx + vy * vy || 1);
          t = Math.max(0, Math.min(1, t));
          inside = Math.hypot(en.pos.x - (x0 + vx * t), en.pos.y - (y0 + vy * t)) < (d.wid as number) * 0.5 + en.radius;
        } else {
          const rx = ctx.wrapDelta(en.pos.x, e.pos.x, state.worldW);
          const ry = ctx.wrapDelta(en.pos.y, e.pos.y, state.worldH);
          inside = Math.hypot(rx, ry) < (d.r as number) + en.radius;
        }
        if (!inside) continue;
        if (isDot) {
          en.hp -= ((d.dps as number) ?? 0) * dt;
          if (d.slow) { en.data ??= {}; en.data.slowUntil = state.now + 0.5; }
        } else if (!hitArr.includes(en.id)) {
          hitArr.push(en.id);
          en.hp -= d.dmg as number;
          if (d.slow) { en.data ??= {}; en.data.slowUntil = state.now + (d.slow as number); }
          if (d.burnHit) { en.data ??= {}; en.data.burnUntil = state.now + 3; }
          // Mace hit reaction: a brief rise, not a knockback launch.
          if (e.kind === "maceimpact") { en.data ??= {}; en.data.liftUntil = state.now + 0.25; }
        }
        if (en.hp <= 0) ctx.killEnemy(en);
      }
      // Mace of Judgment: a second damage event partway through.
      if (e.kind === "maceimpact" && d.second && !d.secondDone && (e.ttl ?? 0) < 0.2) {
        d.secondDone = 1;
        d.hit = [];
      }
    }
  }
}

/** Last valid movement direction (falls back to facing). */
function lastMoveDir(state: GameState): Vec2 {
  const p = state.player;
  const d = (p.data ??= {});
  const ix = state.input.x, iy = state.input.y;
  if (ix || iy) {
    const l = Math.hypot(ix, iy) || 1;
    d.lastDirX = ix / l;
    d.lastDirY = iy / l;
  }
  if (d.lastDirX == null) {
    d.lastDirX = p.facing;
    d.lastDirY = 0;
  }
  return { x: d.lastDirX as number, y: d.lastDirY as number };
}
