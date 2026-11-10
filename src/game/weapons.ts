// Shop weapons: per-weapon combat behavior layered on the basic attack.
// Combat cadence is unchanged; equipmentArt handles per-item visual gestures.
// Each weapon adds its own established projectiles, hazards and on-hit effects.
import type { Entity, GameState, Vec2 } from "./types";
import { weaponDamage } from "./loadout";
import { LIGHT_BRAWL_SECONDS } from "./equipment";
import { WEAPON_COOLDOWN_MUL } from "./shopStats";
import { MOSES_ATTACK, mosesGrip, mosesSwordTip } from './mosesGameArt';
import { AXE_FREEZE_SECONDS, BRANCH_COOLDOWN, BRANCH_KNOCKBACK, BRANCH_WIND_PUSH, BRANCH_WIND_TRAVEL, BRANCH_WIND_WIDTH, DAGGER_GESTURE_SECONDS, DAGGER_RELEASE_PROGRESS, GROUND_IMPACT_DELAY, HARPOON_RELEASE_DELAY, HARPOON_RETARGET_SECONDS, HARPOON_TURN_RATE, MACE_IMPACT_RADIUS, RING_ZAP_CHANCE, SWORD_HORIZONTAL_PROGRESS, spearAttack, turnWeaponAngle } from './weaponAttack';

export type WeaponId = "branch" | "dagger" | "spear" | "sword" | "harpoon" | "axe" | "boomerang" | "mace" | "ring";

export function equippedWeapon(state: GameState): { id: WeaponId; evo: number } {
  const lo = state.loadout;
  return { id: (lo?.weapon.id ?? "branch") as WeaponId, evo: lo?.weapon.evolution ?? 1 };
}

/** Base physical damage of one weapon hit (already includes passives). */
export function weaponHitDamage(state: GameState, base: number): number {
  return base * (weaponDamage(state) / 0.5);
}
/** Bosses and enemy champions shrug off instant-death and %-HP staff effects.
 * Enemy champions don't exist yet: flag them with `data.enemyChampion = 1`. */
export function isToughFoe(en: Entity): boolean {
  return en.kind === "ramses" || !!en.data?.enemyChampion;
}
/** Divine Light beam art is 300x545: its width for a given height. */
export const LIGHT_BEAM_ASPECT = 300 / 545;
/** Is a foe at (rx, ry) from the beam's foot inside its cone of light (as drawn)? */
export function inLightCone(rx: number, ry: number, h: number, radius = 0): boolean {
  const half = h * LIGHT_BEAM_ASPECT * .5;
  if (ry >= 0) return (rx / (half + radius)) ** 2 + (ry / (half * .45 + radius)) ** 2 <= 1;
  if (ry < -h * .85) return false;
  return Math.abs(rx) <= half * (1 + ry / h) + radius * .6;
}
/** Staff of Moses blessing level the next attack carries (0 when not blessed). */
export function pendingBlessEvo(state: GameState): number {
  const f = state.equipFx;
  return f?.empowered ? Number(f.blessEvo ?? 1) : 0;
}
/** Blessed hit, once per foe per attack: level I takes 50 % of max HP, level II
 * 75 % of the remaining HP, level III kills outright (never bosses or champions).
 * The caller applies normal damage and the death check afterwards. */
export function applyBlessing(en: Entity, data: Record<string, unknown> | undefined): void {
  const evo = Number(data?.blessEvo ?? 0);
  if (!evo || isToughFoe(en)) return;
  en.data ??= {};
  if (en.data.blessedBy === data!.blessId) return;
  en.data.blessedBy = Number(data!.blessId);
  if (evo === 1) en.hp -= en.maxHp * .5;
  else if (evo === 2) en.hp -= Math.max(0, en.hp) * .75;
  else en.hp = 0;
}

// ---------------------------------------------------------------- tuning
/** Weapons that only throw projectiles and never perform the melee swing. */
export function weaponIsRangedOnly(id: string): boolean {
  return id === "boomerang" || id === "ring" || id === "harpoon";
}
/** Attack cooldown multiplier (lower = faster). Only the dagger is faster. */
export function weaponCooldownMul(state: GameState): number {
  const { id, evo } = equippedWeapon(state);
  if (id === 'spear') return spearAttack(evo).cooldown;
  if (id === 'branch') return BRANCH_COOLDOWN[evo - 1] ?? 1;
  if (id === 'dagger') return DAGGER_CADENCE[evo - 1] ?? DAGGER_CADENCE[0];
  return WEAPON_COOLDOWN_MUL[id]?.[evo - 1] ?? 1;
}
/** Melee swing duration multiplier for the attack animation. */
export function weaponSwingDurMul(state: GameState): number {
  const { id, evo } = equippedWeapon(state);
  return id === 'branch' ? BRANCH_COOLDOWN[evo - 1] ?? 1 : id === 'spear' ? .7 : id === "dagger" ? DAGGER_CADENCE[evo - 1] ?? DAGGER_CADENCE[0] : 1;
}
/** Melee reach multiplier: longer swords and bigger dagger cones by level. */
export function weaponReachMul(state: GameState): number {
  const { id, evo } = equippedWeapon(state);
  if (id === "sword") return [1, 1.5, 2][evo - 1] ?? 1;
  if (id === "dagger") return [1, 1.35, 1.75][evo - 1] ?? 1;
  if (id === "spear") return spearAttack(evo).reach / 70;
  return 1;
}
/** Melee knockback in px. */
export function weaponKnockback(state: GameState): number {
  const { id, evo } = equippedWeapon(state);
  if (id === "sword") return 10 * ([1, 1.6, 2.2][evo - 1] ?? 1);
  if (id === "spear") return [28, 44, 56][evo - 1] ?? 28;
  if (id === 'branch') return BRANCH_KNOCKBACK[evo - 1] ?? 10;
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

/** One dagger per hand motion at every level; II moves the hand twice as often, III three times. */
export const DAGGER_THROW = [
  { count: 1, reach: 250, spread: 0 },
  { count: 1, reach: 340, spread: 0 },
  { count: 1, reach: 440, spread: 0 },
] as const;
/** Gameplay-only dagger cadence (shop bars keep their own table); a gentle progression per level. */
export const DAGGER_CADENCE = [0.7, 0.58, 0.48] as const;
/** Dagger throw gesture length for a level (seconds). */
export function daggerGestureSeconds(evo: number): number {
  return DAGGER_GESTURE_SECONDS * (DAGGER_CADENCE[evo - 1] ?? DAGGER_CADENCE[0]) / DAGGER_CADENCE[0];
}
/** Horizontal facing defines the forward half-plane, including above/below. */
export function daggerTarget(state: GameState): Entity | null {
  let best: Entity | null = null, distance = Infinity;
  const reach = DAGGER_THROW[equippedWeapon(state).evo - 1]?.reach ?? 250;
  for (const en of state.entities.values()) {
    if (en.team !== 'enemy' || en.hp <= 0) continue;
    const dx = wrapD(en.pos.x, state.player.pos.x, state.worldW);
    const dy = wrapD(en.pos.y, state.player.pos.y, state.worldH);
    const d2 = dx * dx + dy * dy;
    if (dx * state.player.facing < 0 || d2 > reach * reach || d2 >= distance) continue;
    best = en; distance = d2;
  }
  return best;
}
export function weaponLaunchProgress(state: GameState): number | null {
  const at = state.equipFx?.weaponVisualAt;
  const { id, evo } = equippedWeapon(state);
  const duration = id === 'dagger' ? daggerGestureSeconds(evo) : .5;
  if (at == null || state.now < at || state.now - at >= duration) return null;
  return (state.now - at) / duration;
}

/** Melee only reaches what Moses faces: never a foe behind his back
 *  (a few pixels of slack keep foes straight above/below reachable). */
export function inFrontOfMoses(state: GameState, en: Entity): boolean {
  return wrapD(en.pos.x, state.player.pos.x, state.worldW) * state.player.facing >= -4;
}
/** Nearest enemy direction from Moses; falls back to the last movement direction. */
/** Aim stickiness: keep a chosen target at least this long, and only swap
 * early when another foe is clearly closer (squared-distance ratio). */
export const AIM_HOLD_SECONDS = .6;
const AIM_SWITCH_D2 = .75 * .75;
/** After a directional attack Moses keeps facing his target this long, so
 * walking the other way between throws doesn't flip him back and forth. */
export const FACE_LOCK_SECONDS = .9;
export function aimDir(state: GameState): Vec2 {
  const p = state.player;
  const fx = (state.equipFx ??= {});
  let best: Entity | null = null, bd = Infinity;
  for (const en of state.entities.values()) {
    if (en.team !== "enemy" || en.hp <= 0 || en.data?.sealed) continue;
    const dx = wrapD(en.pos.x, p.pos.x, state.worldW), dy = wrapD(en.pos.y, p.pos.y, state.worldH);
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = en; }
  }
  // Stay on the current target unless it is gone or another is clearly closer.
  const current = fx.aimTargetId != null ? state.entities.get(fx.aimTargetId) : undefined;
  if (best && current && current !== best && current.team === "enemy" && current.hp > 0 && !current.data?.sealed) {
    const cd2 = wrapD(current.pos.x, p.pos.x, state.worldW) ** 2 + wrapD(current.pos.y, p.pos.y, state.worldH) ** 2;
    if (state.now < (fx.aimHoldUntil ?? 0) || bd >= cd2 * AIM_SWITCH_D2) { best = current; bd = cd2; }
  }
  if (best && best.id !== fx.aimTargetId) { fx.aimTargetId = best.id; fx.aimHoldUntil = state.now + AIM_HOLD_SECONDS; }
  if (!best) return lastMoveDir(state);
  const dx = wrapD(best.pos.x, p.pos.x, state.worldW), dy = wrapD(best.pos.y, p.pos.y, state.worldH);
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}
/** Presentation aim follows the same nearest target without changing cast collision. */
export function updateWeaponAim(state: GameState, dt: number): void {
  if (!['spear', 'harpoon'].includes(equippedWeapon(state).id)) return;
  const dir = aimDir(state), fx = (state.equipFx ??= {});
  const target = Math.atan2(dir.y, dir.x);
  fx.weaponVisualAim = turnWeaponAngle(fx.weaponVisualAim ?? (state.player.facing === 1 ? 0 : Math.PI), target, dt);
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
  basicDamage?: number,
): void {
  const { id, evo } = equippedWeapon(state);
  // A charged Staff of Moses blessing rides on everything this one attack spawns;
  // thrown weapons keep its glow while flying.
  const fxs = (state.equipFx ??= {});
  const blessEvo = pendingBlessEvo(state);
  const blessed = blessEvo ? 1 : 0;
  if (blessEvo) {
    fxs.empowered = 0; fxs.empowerGlowUntil = state.now + .6;
    const blessing = { blessEvo, blessId: Number(fxs.blessId ?? 0), empowered: 1 };
    const raw = spawn;
    spawn = (kind, pos, ttl, data, team) => raw(kind, pos, ttl, Object.assign(data, blessing), team);
  }
  const launch = () => { (state.equipFx ??= {}).weaponVisualAt = state.now; };
  const p = state.player;
  const dir: Vec2 = aimDir(state);
  const dmg = weaponHitDamage(state, 14);
  const ang = Math.atan2(dir.y, dir.x);
  if (['spear', 'harpoon', 'axe', 'mace'].includes(id)) {
    (state.equipFx ??= {}).weaponAimAngle = ang;
    // Nearly vertical targets keep the current facing (no flip for a foe straight above/below).
    if (Math.abs(dir.x) > .25) p.facing = dir.x >= 0 ? 1 : -1;
    fxs.faceLockUntil = state.now + FACE_LOCK_SECONDS;
  }

  switch (id) {
    case "spear": {
      // Melee only: a horizontal piercing thrust FX in front of Moses.
      const duration = .5 * weaponSwingDurMul(state);
      spawn("spearthrust", { ...p.pos }, duration, { facing: p.facing, angle: ang, len: spearAttack(evo).reach, impactAt: state.now + duration * .2, duration: duration * .8, evo }, "hazard");
      break;
    }
    case "dagger": {
      const target = daggerTarget(state);
      if (!target) break;
      // Overhand throw: the dagger leaves the hand at the release beat of the gesture.
      const fireAt = state.now + daggerGestureSeconds(evo) * DAGGER_RELEASE_PROGRESS;
      spawn('daggerthrow', { ...p.pos }, fireAt - state.now + .1, {
        fireAt, targetId: target.id, evo, facing: p.facing, dmg: basicDamage ?? dmg, empowered: blessed,
      }, 'hazard');
      launch();
      break;
    }
    case "harpoon": {
      const proc = Math.random() < (HARPOON_WHIRL_CHANCE[evo - 1] ?? 0);
      // Released from the hand at the forward peak of the throw gesture.
      spawn('harpoonthrow', { ...p.pos }, HARPOON_RELEASE_DELAY + .1, {
        fireAt: state.now + HARPOON_RELEASE_DELAY, vx: dir.x * 400, vy: dir.y * 400, dmg,
        pierce: evo >= 2 ? 3 : 1, knock: 16,
        whirlpool: proc ? (evo >= 3 ? 1.3 : 1) : 0, evo, empowered: blessed,
      }, 'hazard');
      launch();
      break;
    }
    case "boomerang": {
      const n = evo; // 1/2/3 independent returning projectiles
      for (let i = 0; i < n; i++) {
        const a = ang + (i - (n - 1) / 2) * 0.5;
        spawn("wpboom", { ...p.pos }, 2.2, {
          vx: Math.cos(a) * 320, vy: Math.sin(a) * 320,
          dmg, phase: 0, flash: evo >= 3 ? 1 : 0, evo, empowered: blessed,
        }, "projectile");
      }
      launch();
      break;
    }
    case "ring": {
      spawn("wpring", { ...p.pos }, 4.0, {
        vx: dir.x * 380, vy: dir.y * 380, dmg,
        bounces: RING_BOUNCES[evo - 1] ?? 4, returning: 0, knock: 12,
        electric: evo >= 3 ? 1 : 0, evo, empowered: blessed,
      }, "projectile");
      launch();
      break;
    }
    case "axe": {
      // Ground cut toward the nearest enemy (never behind Moses by accident).
      const len = evo >= 3 ? 260 : evo >= 2 ? 200 : 150;
      const wid = evo >= 3 ? 46 : evo >= 2 ? 34 : 22;
      const grip = mosesGrip(p.pos.x, p.pos.y + 8, p.facing);
      spawn("axeline", { x: p.pos.x + dir.x * len * 0.5, y: p.pos.y + dir.y * len * 0.5 }, GROUND_IMPACT_DELAY + 0.45, {
        dmg, len, wid, angle: ang,
        impactAt: state.now + GROUND_IMPACT_DELAY,
        slow: evo >= 2 ? 2 : 0, freeze: evo >= 3 ? AXE_FREEZE_SECONDS : 0, cracks: evo >= 3 ? 1 : 0, hit: [], handleX: grip.x, handleY: grip.y, knock: 18,
      }, "hazard");
      break;
    }
    case "mace": {
      const reach = 64;
      const r = MACE_IMPACT_RADIUS[evo - 1] ?? 48;
      spawn("maceimpact", { x: p.pos.x + dir.x * reach, y: p.pos.y + dir.y * reach }, GROUND_IMPACT_DELAY + 0.4, {
        dmg, r, second: evo >= 3 ? 1 : 0, hit: [], impactAt: state.now + GROUND_IMPACT_DELAY, rotation: 0,
        // Alternate horizontal mirroring so consecutive impacts look different.
        flipX: (fxs.maceFlip = fxs.maceFlip ? 0 : 1) ? -1 : 1,
      }, "hazard");
      break;
    }
    case "branch": {
      // Same soft wind arc at every level, flying toward the nearest foe and pushing back what it crosses.
      spawn('branchwind', { ...p.pos }, MOSES_ATTACK.WINDUP + BRANCH_WIND_TRAVEL.duration, { angle: ang, evo, impactAt: state.now + MOSES_ATTACK.WINDUP, originX: p.pos.x, originY: p.pos.y, hit: [] }, 'hazard');
      if (evo >= 3) spawn("shockwave", { ...p.pos }, 0.35, { dmg: dmg * 0.5, r: 90, hit: [] }, "hazard");
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- melee hits
function applyDaggerPoison(state: GameState, en: Entity, evo: number): void {
  const pz = DAGGER_POISON[evo - 1] ?? DAGGER_POISON[0];
  if (Math.random() >= pz.chance) return;
  const data = (en.data ??= {});
  data.poisonUntil = state.now + pz.dur;
  data.poisonDps = weaponHitDamage(state, pz.dps);
  data.poisonSpread = evo >= 2 ? 1 : 0;
  data.poisonCloud = evo >= 3 ? 1 : 0;
}
// Called for every enemy hit by the basic melee swing.
export function weaponOnMeleeHit(state: GameState, en: Entity): void {
  const { id, evo } = equippedWeapon(state);
  en.data ??= {};
  switch (id) {
    case "dagger": {
      applyDaggerPoison(state, en, evo);
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
      // Evolution knockback is applied once through weaponKnockback.
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
  // Diamond Staff cut: bleeds until death (the engine's death sweep removes the foe).
  if (Number(d.bleedDps) > 0 && !isToughFoe(en)) en.hp -= Number(d.bleedDps) * dt;
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

    if (e.kind === 'swordwind') {
      if (state.now >= Number(d.impactAt)) {
        if (!d.released) {
          const elapsed = Number(d.releaseDelay);
          const moving = Math.hypot(p.vel.x, p.vel.y) > 5;
          const bodyDY = moving ? (Math.sin(p.animT * 4.2) > .4 ? -1 : 0) : Math.sin(state.now * 1.6) > .55 ? -1 : 0;
          const bob = moving && Math.sin(p.animT * 4.2) > 0 ? -1 : 0;
          const tip = mosesSwordTip(p.pos.x, p.pos.y + 8 + bob, p.facing === -1 ? -1 : 1, Number(d.evo), elapsed / MOSES_ATTACK.DUR, SWORD_HORIZONTAL_PROGRESS, bodyDY);
          // Projectile simulation uses ground coordinates; rendering subtracts 32.
          e.pos = { x: tip.x, y: tip.y + 32 };
          d.released = 1;
          continue;
        }
        e.pos.x += Number(d.vx) * dt;
        e.pos.y += Number(d.vy) * dt;
        d.travelled = Number(d.travelled) + 650 * dt;
        const hit = (d.hit ??= []) as number[];
        for (const en of state.entities.values()) {
          if (en.team !== 'enemy' || en.hp <= 0 || hit.includes(en.id)) continue;
          const rx = ctx.wrapDelta(en.pos.x, e.pos.x, state.worldW), ry = ctx.wrapDelta(en.pos.y, e.pos.y, state.worldH);
          if (Math.hypot(rx, ry) > en.radius + 26) continue;
          hit.push(en.id); applyBlessing(en, d); en.hp -= Number(d.dmg ?? 0);
          if (Number(d.evo) >= 3) { en.data ??= {}; en.data.burnUntil = state.now + 2; }
          if (en.hp <= 0) ctx.killEnemy(en);
        }
      }
      continue;
    }

    if (e.kind === 'harpoonthrow') {
      if (state.now >= Number(d.fireAt) && !d.fired) {
        d.fired = 1; e.ttl = 0;
        const grip = mosesGrip(p.pos.x, p.pos.y + 8, p.facing);
        const target = nearestEnemyTo(state, grip, ctx.wrapDelta);
        ctx.spawn('wpnproj', grip, 1.4, { vx: d.vx, vy: d.vy, dmg: d.dmg, pierce: d.pierce, knock: d.knock, whirlpool: d.whirlpool, art: 'harpoon', evo: d.evo, fromHand: 1, empowered: d.empowered, blessEvo: d.blessEvo, blessId: d.blessId, homing: 1, targetId: target?.id, retargetAt: state.now }, 'projectile');
      }
      continue;
    }

    if (e.kind === 'daggerthrow') {
      if (state.now >= Number(d.fireAt) && !d.fired) {
        d.fired = 1; e.ttl = 0;
        const evo = Number(d.evo ?? 1);
        const cfg = DAGGER_THROW[evo - 1] ?? DAGGER_THROW[0];
        // Leaves from the dagger in Moses' hand: simulated on the ground under the
        // hand, drawn lifted to the hand's height (see the dagger renderer).
        const grip = mosesGrip(p.pos.x, p.pos.y + 8, p.facing);
        const from = { x: grip.x + p.facing * 8, y: p.pos.y };
        const target = state.entities.get(Number(d.targetId));
        const alive = target && target.team === 'enemy' && target.hp > 0;
        const dx = alive ? ctx.wrapDelta(target.pos.x, from.x, state.worldW) : p.facing;
        const dy = alive ? ctx.wrapDelta(target.pos.y, from.y, state.worldH) : 0;
        const a = Math.atan2(dy, dx);
        // Stay in the forward half-plane Moses is facing.
        const vx = p.facing * Math.abs(Math.cos(a)) * 400, vy = Math.sin(a) * 400;
        ctx.spawn('wpnproj', from, cfg.reach / 400, { vx, vy, dmg: d.dmg, pierce: 1, art: 'dagger', evo, targetId: d.targetId, poisonEvo: evo, empowered: d.empowered, blessEvo: d.blessEvo, blessId: d.blessId, lift: from.y - grip.y }, 'projectile');
      }
      continue;
    }

    if (e.kind === 'stafftornado') {
      // Wind Staff tornado stays with Moses, just in front of him.
      e.pos.x = p.pos.x; e.pos.y = p.pos.y + 1;
      continue;
    }
    if (e.kind === 'stafflight') {
      // Divine Light: every foe the beam's cone touches is blinded and brawls (never Ramses).
      const hit = (d.hit ??= []) as number[];
      for (const en of state.entities.values()) {
        if (en.team !== 'enemy' || en.hp <= 0 || en.kind === 'ramses' || hit.includes(en.id)) continue;
        const rx = ctx.wrapDelta(en.pos.x, e.pos.x, state.worldW), ry = ctx.wrapDelta(en.pos.y, e.pos.y, state.worldH);
        if (!inLightCone(rx, ry, Number(d.h ?? 260), en.radius)) continue;
        hit.push(en.id);
        en.data ??= {};
        en.data.blindUntil = state.now + LIGHT_BRAWL_SECONDS;
        en.data.brawlUntil = state.now + LIGHT_BRAWL_SECONDS;
        en.data.brawlDmg = Number(d.brawlDmg ?? 6);
        en.data.brawlNext = state.now + .4 + Math.random() * .3;
      }
      continue;
    }
    if (e.kind === 'staffshard') {
      // Diamond Staff shard: flies straight, cuts every foe it crosses once; cut foes bleed.
      e.pos.x += Number(d.vx) * dt; e.pos.y += Number(d.vy) * dt;
      const hit = (d.hit ??= []) as number[];
      for (const en of [...state.entities.values()]) {
        if (en.team !== 'enemy' || en.hp <= 0 || hit.includes(en.id)) continue;
        const rx = ctx.wrapDelta(en.pos.x, e.pos.x, state.worldW), ry = ctx.wrapDelta(en.pos.y, e.pos.y, state.worldH);
        if (Math.hypot(rx, ry) > 10 + en.radius) continue;
        hit.push(en.id);
        en.hp -= Number(d.dmg ?? 8);
        if (!isToughFoe(en)) {
          en.data ??= {};
          en.data.bleedDps = Math.max(Number(en.data.bleedDps ?? 0), en.maxHp * Number(d.bleed ?? .08));
          en.data.bleedAt ??= state.now;
        }
        ctx.spawn('staffblood', { x: en.pos.x, y: en.pos.y - 14 }, .4, { variant: Math.floor(Math.random() * 5), seed: Math.floor(Math.random() * 1000), dirX: Math.sign(Number(d.vx)) || 1, maxTtl: .4, dps: 0 }, 'hazard');
        if (en.hp <= 0) ctx.killEnemy(en);
      }
      continue;
    }
    if (e.kind === 'staffwave') {
      // Primordial Waters wave: hurts and slows every foe it rolls over once, then carries
      // it along at the wave's front until the wave breaks (Ramses is too heavy to move).
      e.pos.x += Number(d.vx) * dt; e.pos.y += Number(d.vy) * dt;
      const hit = (d.hit ??= []) as number[];
      for (const id of hit) {
        const en = state.entities.get(id);
        if (!en || en.hp <= 0 || en.kind === 'ramses' || en.data?.stoneUntil != null) continue;
        en.pos.x += Number(d.vx) * dt; en.pos.y += Number(d.vy) * dt;
      }
      for (const en of [...state.entities.values()]) {
        if (en.team !== 'enemy' || en.hp <= 0 || hit.includes(en.id)) continue;
        const rx = ctx.wrapDelta(en.pos.x, e.pos.x, state.worldW), ry = ctx.wrapDelta(en.pos.y, e.pos.y, state.worldH);
        if (Math.hypot(rx, ry) > Number(d.r ?? 46) + en.radius) continue;
        hit.push(en.id);
        en.hp -= Number(d.dmg ?? 30);
        en.data ??= {};
        en.data.slowUntil = Math.max(Number(en.data.slowUntil ?? 0), state.now + 2.5);
        ctx.spawn('hitspark', { x: en.pos.x, y: en.pos.y - 14 }, .18, { seed: en.id, small: 1, maxTtl: .18 }, 'hazard');
        if (en.hp <= 0) ctx.killEnemy(en);
      }
      continue;
    }

    if (e.kind === 'branchwind') {
      // The gust pushes back every foe it crosses, once, along its flight.
      const t = (state.now - Number(d.impactAt)) / BRANCH_WIND_TRAVEL.duration;
      if (t < 0 || t > 1) continue;
      const ang = Number(d.angle ?? 0), evo = Number(d.evo ?? 1);
      const along = BRANCH_WIND_TRAVEL.start + t * BRANCH_WIND_TRAVEL.distance;
      const cx = p.pos.x + Math.cos(ang) * along, cy = p.pos.y + Math.sin(ang) * along;
      const reach = (BRANCH_WIND_WIDTH[evo - 1] ?? BRANCH_WIND_WIDTH[0]) * .55;
      const push = BRANCH_WIND_PUSH[evo - 1] ?? BRANCH_WIND_PUSH[0];
      const hit = (d.hit ??= []) as number[];
      for (const en of state.entities.values()) {
        if (en.team !== 'enemy' || en.hp <= 0 || hit.includes(en.id) || en.kind === 'ramses') continue;
        if (en.kind === 'agilesoldier' && en.data?.specialDash) continue;
        const rx = ctx.wrapDelta(en.pos.x, cx, state.worldW), ry = ctx.wrapDelta(en.pos.y, cy, state.worldH);
        if (Math.hypot(rx, ry) > reach + en.radius) continue;
        hit.push(en.id);
        en.data ??= {};
        // Eased slide over 0.22 s (integral = 0.11 * velocity), never a teleport.
        en.data.knockVx = Math.cos(ang) * push / .11; en.data.knockVy = Math.sin(ang) * push / .11;
        en.data.knockUntil = state.now + .22;
      }
      continue;
    }

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
        if (dd < 20) { e.ttl = 0; ringZap(state, e, ctx); continue; }
      }
      if (e.kind === 'wpring' && (e.ttl ?? 0) <= dt) ringZap(state, e, ctx);
      if (e.kind === 'wpnproj' && d.homing) steerHarpoon(state, e, dt, ctx.wrapDelta);
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
        applyBlessing(en, d);
        en.hp -= dmg;
        if (d.poisonEvo) applyDaggerPoison(state, en, Number(d.poisonEvo));
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
    if (["axeline", "maceimpact", "shockwave", "whirlpool", "toxiccloud", "firering", "slowwave", "windtrail", "slowprint", "waterorbit", "godhand"].includes(e.kind)) {
      if (state.now < Number(d.impactAt ?? e.born)) continue;
      // The fist strikes once; its crack lingers only as a picture.
      if (e.kind === "godhand" && state.now > Number(d.impactAt) + .15) continue;
      if (e.kind === "waterorbit") { e.pos.x = state.player.pos.x; e.pos.y = state.player.pos.y; }
      const hitArr = (d.hit ??= []) as number[];
      const isDot = e.kind === "waterorbit" || e.kind === "whirlpool" || e.kind === "toxiccloud" || e.kind === "windtrail" || e.kind === "slowprint";
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
          const dist = Math.hypot(rx, ry);
          // Expanding fire ring grows from Moses to its full radius over its life.
          const r = e.kind === "firering" && d.grow ? Number(d.r) * Math.min(1, (state.now - e.born) / Math.max(.01, Number(d.ttl0 ?? 1))) : Number(d.r);
          inside = e.kind === "waterorbit" ? Math.abs(dist - r) < Number(d.width ?? 20) + en.radius : dist < r + en.radius;
        }
        // Axe and mace are melee: they never strike behind Moses.
        if (inside && (e.kind === "axeline" || e.kind === "maceimpact") && !inFrontOfMoses(state, en)) inside = false;
        if (!inside) continue;
        if (isDot) {
          en.hp -= ((d.dps as number) ?? 0) * dt;
          if (d.slow) { en.data ??= {}; en.data.slowUntil = state.now + 0.5; }
        } else if (!hitArr.includes(en.id)) {
          hitArr.push(en.id);
          applyBlessing(en, d);
          en.hp -= e.kind === "godhand" && en.kind === "ramses" ? Math.min(Number(d.dmg), en.maxHp * .1) : d.dmg as number;
          if (e.kind === "godhand") { en.data ??= {}; en.data.liftAt = state.now; }
          if (d.slow) { en.data ??= {}; en.data.slowUntil = state.now + (d.slow as number); }
          if (d.freeze) { en.data ??= {}; en.data.axeFreezeUntil = state.now + Number(d.freeze); }
          if (d.burnHit) { en.data ??= {}; en.data.burnUntil = state.now + (e.kind === 'firering' ? 4 : 3); }
          if (e.kind === 'axeline' && !(en.kind === 'agilesoldier' && en.data?.specialDash)) {
            const dx = ctx.wrapDelta(en.pos.x, Number(d.handleX), state.worldW);
            const dy = ctx.wrapDelta(en.pos.y, Number(d.handleY), state.worldH);
            const length = Math.hypot(dx, dy);
            const angle = Number(d.angle);
            en.pos.x += (length ? dx / length : Math.cos(angle)) * Number(d.knock ?? 18);
            en.pos.y += (length ? dy / length : Math.sin(angle)) * Number(d.knock ?? 18);
          }
          // Mace hit reaction: a brief rise, not a knockback launch.
          if (e.kind === "maceimpact") { en.data ??= {}; en.data.liftAt = state.now; }
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

function nearestEnemyTo(state: GameState, from: Vec2, wrapDelta: (a: number, b: number, size: number) => number, skip?: Set<number>): Entity | null {
  let best: Entity | null = null, bd = Infinity;
  for (const en of state.entities.values()) {
    if (en.team !== 'enemy' || en.hp <= 0 || en.data?.sealed || skip?.has(en.id)) continue;
    const d2 = wrapDelta(en.pos.x, from.x, state.worldW) ** 2 + wrapDelta(en.pos.y, from.y, state.worldH) ** 2;
    if (d2 < bd) { bd = d2; best = en; }
  }
  return best;
}

/** Harpoon homing: every 0.3 s it re-reads the target's position (picking the
 * nearest unhit foe if the target is gone) and between refreshes turns smoothly
 * toward that heading, keeping its speed. */
function steerHarpoon(state: GameState, e: Entity, dt: number, wrapDelta: (a: number, b: number, size: number) => number): void {
  const d = e.data!;
  const hitSet = d.hit as Set<number> | undefined;
  if (state.now >= Number(d.retargetAt ?? 0)) {
    d.retargetAt = state.now + HARPOON_RETARGET_SECONDS;
    let target = state.entities.get(Number(d.targetId));
    if (!target || target.team !== 'enemy' || target.hp <= 0 || hitSet?.has(target.id)) {
      target = nearestEnemyTo(state, e.pos, wrapDelta, hitSet) ?? undefined;
      d.targetId = target?.id;
    }
    if (target) d.aimAngle = Math.atan2(wrapDelta(target.pos.y, e.pos.y, state.worldH), wrapDelta(target.pos.x, e.pos.x, state.worldW));
  }
  if (d.aimAngle == null) return;
  const speed = Math.hypot(Number(d.vx), Number(d.vy)) || 400;
  const current = Math.atan2(Number(d.vy), Number(d.vx));
  const delta = Math.atan2(Math.sin(Number(d.aimAngle) - current), Math.cos(Number(d.aimAngle) - current));
  const next = current + delta * (1 - Math.exp(-HARPOON_TURN_RATE * dt));
  d.vx = Math.cos(next) * speed; d.vy = Math.sin(next) * speed;
}

/** Gold lightning on every still-living foe this ring touched, when it vanishes. */
function ringZap(state: GameState, ring: Entity, ctx: { killEnemy: (en: Entity) => void; spawn: (kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>, team?: Entity["team"]) => Entity }): void {
  const d = ring.data ?? {};
  if (d.zapped) return;
  d.zapped = 1;
  if (Math.random() >= (RING_ZAP_CHANCE[Number(d.evo ?? 1) - 1] ?? .35)) return;
  const points: { x: number; y: number }[] = [];
  for (const id of (d.hit as Set<number> | undefined) ?? []) {
    const en = state.entities.get(id);
    if (!en || en.team !== 'enemy' || en.hp <= 0) continue;
    en.hp -= Number(d.dmg ?? 0) * .8;
    points.push({ x: en.pos.x, y: en.pos.y });
    if (en.hp <= 0) ctx.killEnemy(en);
  }
  if (points.length) ctx.spawn('ringzap', { ...ring.pos }, .45, { points }, 'hazard');
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
