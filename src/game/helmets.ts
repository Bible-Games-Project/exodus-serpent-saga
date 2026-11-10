// Helmets (the shop "shield" category). Every helmet raises Moses' shield
// capacity (the extra part of the shield bar is painted in the helmet colour);
// helmets 2-10 also carry one timed ability that reacts to enemy attacks.
//
// An "attack" is one enemy blow: one projectile, one melee swing, or a stretch
// of contact damage. Damage arrives every frame while a swing connects, so each
// attacker's blow is remembered for a short window and every frame of the same
// blow gets the same treatment (blocked, halved, ...). Charges are spent once
// per blow, never per frame.
import type { Entity, GameState, Vec2 } from "./types";

/** Monochrome effect colour per helmet, sampled from the helmet art. */
export const HELMET_COLOR: Record<string, string> = {
  abel: "#5b86e5",
  noah: "#b8a067",
  abraham: "#f0c64a",
  jacobm: "#e9dcb6",
  joseph: "#e0a060",
  bushp: "#f07a2a",
  promise: "#ffb820",
  cloud: "#d4ebff",
  covenant: "#fff0b0",
  israel: "#cfdcf0",
};

export function helmetColor(id?: string): string {
  return HELMET_COLOR[id ?? ""] ?? "#5fb4ff";
}

/** Ability timings (seconds) and amounts. */
export const HELMET = {
  noahEvery: 15,
  abrahamEvery: 15, abrahamHits: 3, abrahamMul: 0.5,
  jacobEvery: 20, jacobHits: 3,
  josephQuiet: 15, josephHeal: 0.05,
  bushQuiet: 15, bushHeal: 0.15,
  promiseEvery: 20, promiseFor: 1,
  cloudEvery: 20, cloudFor: 1,
  covenantEvery: 20,
  israelEvery: 20, israelFor: 1,
  /** frames of the same blow arrive closer than this */
  blowGap: 0.35,
  /** one blow never lasts longer than this (continuous contact restarts it) */
  blowMax: 0.6,
} as const;

/** What a helmet did to one blow. */
enum Blow { Normal, Block, Half, Dust, Angel }

type Memo = { start: number; last: number; mode: Blow };
const blows = new WeakMap<GameState, Map<number, Memo>>();
const sealedSets = new WeakMap<GameState, Set<number>>();

function fx(state: GameState): Record<string, number> {
  return (state.equipFx ??= {});
}

function helmetId(state: GameState): string | undefined {
  return state.loadout?.shield.id;
}

/** Ramses and enemy champions are never sealed or turned to dust. */
function tough(e: Entity): boolean {
  return e.kind === "ramses" || !!e.data?.enemyChampion;
}

function spawnFx(state: GameState, kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>): void {
  const e: Entity = {
    id: state.nextId++, pos: { x: pos.x, y: pos.y }, vel: { x: 0, y: 0 }, radius: 4,
    hp: 1, maxHp: 1, team: "hazard", facing: 1, animT: 0, born: state.now, ttl, kind,
    data: { ...data, dps: 0, maxTtl: ttl },
  };
  state.entities.set(e.id, e);
}

/** Shield capacity from the equipped helmet: maxShield = base × (1 + capPct).
 *  The helmet part is kept in `shieldBonus` so the bar can paint it apart. */
export function applyShieldCapacity(state: GameState, refill = false): void {
  const base = Math.max(1, (state.maxShield ?? 50) - (state.shieldBonus ?? 0));
  const cap = state.loadout?.shield.capPct ?? 0;
  const bonus = Math.max(0, Math.round(base * cap / 100));
  state.shieldBonus = bonus;
  state.maxShield = base + bonus;
  state.shield = refill ? state.maxShield : Math.min(state.shield ?? base, state.maxShield);
}

/** Refill the timed charges whose cooldown has passed. */
function refill(state: GameState): void {
  const f = fx(state), id = helmetId(state), now = state.now;
  if (id === "abraham" && !(f.helmCharges > 0) && now >= (f.helmReady ?? 0)) {
    f.helmCharges = HELMET.abrahamHits;
  }
  if (id === "jacobm" && !(f.helmCharges > 0) && now >= (f.helmReady ?? 0)) {
    f.helmCharges = HELMET.jacobHits;
    f.helmBubbleAt = now;
  }
}

/** Where a blow from `from` meets Moses' body, and its direction. */
function impact(state: GameState, from: Vec2 | undefined): { pos: Vec2; dirX: number; dirY: number } {
  const p = state.player.pos;
  let dx = from ? from.x - p.x : state.player.facing, dy = from ? from.y - p.y : 0;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;
  return { pos: { x: p.x, y: p.y + 2 }, dirX: dx, dirY: dy };
}

/** Champions and sealed foes enemies may target (sealed foes are allies). */
export function sealedAllies(state: GameState): Entity[] {
  const set = sealedSets.get(state);
  if (!set || !set.size) return [];
  const out: Entity[] = [];
  for (const id of set) {
    const e = state.entities.get(id);
    if (e && e.hp > 0 && e.data?.sealed) out.push(e);
    else set.delete(id);
  }
  return out;
}

/** Light of the Covenant: the foe becomes Moses' ally for the rest of its life. */
export function sealEnemy(state: GameState, e: Entity): void {
  const d = (e.data ??= {});
  d.sealed = 1;
  d.sealAt = state.now;
  d.sealHp = e.hp;
  // Champions already ignore converted foes; this one stays converted for good.
  d.convertedUntil = 1e12;
  d.brawlDmg = Math.max(8, Number(d.contactDmg ?? 8));
  for (const k of ["brawlUntil", "blindUntil", "brawlStrikeAt", "tgtId", "tgtAt", "cageUntil", "knockUntil", "specialDash", "charging"]) delete d[k];
  let set = sealedSets.get(state);
  if (!set) { set = new Set(); sealedSets.set(state, set); }
  set.add(e.id);
  spawnFx(state, "helmseal", { x: e.pos.x, y: e.pos.y + 2 }, 0.9, { follow: e.id, color: helmetColor("covenant") });
}

/**
 * Helmet abilities applied to incoming damage. `src` is the entity dealing the
 * blow (the enemy, or the enemy projectile); damage without a source (poison)
 * is only stopped by the invincibility windows. Returns the damage left.
 */
export function helmetModifyDamage(state: GameState, amount: number, projectile: boolean, src?: Entity): number {
  const id = helmetId(state);
  if (!id || !(amount > 0)) return amount;
  const f = fx(state), now = state.now;
  const color = helmetColor(id);
  if (src) f.helmTouchAt = now;

  // Running windows block everything, sourced or not.
  if (id === "promise" && now < (f.helmInvulnUntil ?? 0)) {
    if (src) flashOnce(state, src, "block", color);
    return 0;
  }
  if (id === "israel" && now < (f.helmAngelsUntil ?? 0)) {
    if (src) flashOnce(state, src, "angel", color);
    return 0;
  }
  if (!src) return id === "cloud" && now < (f.helmDustUntil ?? 0) ? 0 : amount;

  let memo = blows.get(state);
  if (!memo) { memo = new Map(); blows.set(state, memo); }
  const m = memo.get(src.id);
  if (m && now - m.last <= HELMET.blowGap && now - m.start <= HELMET.blowMax) {
    m.last = now;
    return scale(amount, m.mode);
  }
  if (memo.size > 64) for (const [k, v] of memo) if (now - v.last > 2) memo.delete(k);

  const attacker = projectile ? (src.ownerId != null ? state.entities.get(src.ownerId) : undefined) : src;
  const from = attacker?.pos ?? src.pos;
  const hit = impact(state, from);
  refill(state);
  let mode = Blow.Normal;

  switch (id) {
    case "noah":
      if (now >= (f.helmReady ?? 0)) {
        f.helmReady = now + HELMET.noahEvery;
        mode = Blow.Block;
        spawnFx(state, "helmhit", hit.pos, 0.55, { dirX: hit.dirX, dirY: hit.dirY, color, style: "shield" });
      }
      break;
    case "abraham":
      if (f.helmCharges > 0) {
        f.helmCharges -= 1;
        if (f.helmCharges <= 0) f.helmReady = now + HELMET.abrahamEvery;
        mode = Blow.Half;
        // Shown on Moses himself: his golden ward cracks, one charge spent.
        spawnFx(state, "helmweaken", { ...state.player.pos }, 0.75, { color, left: f.helmCharges });
        spawnFx(state, "helmhit", hit.pos, 0.4, { dirX: hit.dirX, dirY: hit.dirY, color, style: "half" });
      }
      break;
    case "jacobm":
      if (f.helmCharges > 0) {
        f.helmCharges -= 1;
        if (f.helmCharges <= 0) { f.helmReady = now + HELMET.jacobEvery; f.helmBubblePopAt = now; }
        mode = Blow.Block;
        spawnFx(state, "helmhit", hit.pos, 0.45, { dirX: hit.dirX, dirY: hit.dirY, color, style: "bubble" });
      }
      break;
    case "promise":
      if (now >= (f.helmReady ?? 0)) {
        f.helmReady = now + HELMET.promiseEvery;
        f.helmInvulnUntil = now + HELMET.promiseFor;
        f.helmInvulnAt = now;
        mode = Blow.Block;
        spawnFx(state, "helmhit", hit.pos, 0.5, { dirX: hit.dirX, dirY: hit.dirY, color, style: "shield" });
      }
      break;
    case "cloud":
      if (now >= (f.helmReady ?? 0) || now < (f.helmDustUntil ?? 0)) {
        if (!(now < (f.helmDustUntil ?? 0))) {
          f.helmReady = now + HELMET.cloudEvery;
          f.helmDustUntil = now + HELMET.cloudFor;
          f.helmDustAt = now;
        }
        mode = Blow.Dust;
        if (attacker && attacker.team === "enemy" && !tough(attacker)) {
          attacker.data ??= {};
          attacker.data.helmDust = 1;
          f.helmDustPending = 1;
        }
        spawnFx(state, "helmhit", hit.pos, 0.4, { dirX: hit.dirX, dirY: hit.dirY, color, style: "dust" });
      }
      break;
    case "covenant":
      if (now >= (f.helmReady ?? 0) && attacker && attacker.team === "enemy" && !tough(attacker) && !attacker.data?.sealed) {
        f.helmReady = now + HELMET.covenantEvery;
        mode = Blow.Block;
        sealEnemy(state, attacker);
        spawnFx(state, "helmhit", hit.pos, 0.5, { dirX: hit.dirX, dirY: hit.dirY, color, style: "shield" });
      }
      break;
    case "israel":
      if (now >= (f.helmReady ?? 0)) {
        f.helmReady = now + HELMET.israelEvery;
        f.helmAngelsUntil = now + HELMET.israelFor;
        f.helmAngelsAt = now;
        mode = Blow.Angel;
        flashOnce(state, src, "angel", color);
      }
      break;
  }
  memo.set(src.id, { start: now, last: now, mode });
  return scale(amount, mode);
}

function scale(amount: number, mode: Blow): number {
  if (mode === Blow.Normal) return amount;
  if (mode === Blow.Half) return amount * HELMET.abrahamMul;
  return 0;
}

/** One impact flash per blow while an invincibility window is running. */
function flashOnce(state: GameState, src: Entity, style: string, color: string): void {
  const f = fx(state);
  const key = `helmFlash${src.id}`;
  if (state.now - (f[key] ?? -9) < HELMET.blowMax) return;
  for (const k of Object.keys(f)) if (k.startsWith("helmFlash") && state.now - f[k] > 2) delete f[k];
  f[key] = state.now;
  const attacker = src.ownerId != null ? state.entities.get(src.ownerId) ?? src : src;
  const hit = impact(state, attacker.pos);
  // The angel nearest the attacker takes the blow.
  const ang = style === "angel" ? angelNearest(state, hit.dirX, hit.dirY) : 0;
  spawnFx(state, "helmhit", hit.pos, 0.45, { dirX: hit.dirX, dirY: hit.dirY, color, style, angel: ang });
}

/** Angle (radians) of each of the 3 guardian angels around Moses at `t`. */
export function angelAngles(t: number): number[] {
  const spin = t * 0.9;
  return [0, 1, 2].map((i) => -Math.PI / 2 + i * (Math.PI * 2 / 3) + spin);
}
/** Ellipse radii of the angels' ring around Moses (world px). */
export const ANGEL_RING = { rx: 52, ry: 26 } as const;

function angelNearest(state: GameState, dx: number, dy: number): number {
  const t = state.now - (fx(state).helmAngelsAt ?? state.now);
  let best = 0, bd = -Infinity;
  angelAngles(t).forEach((a, i) => { const s = Math.cos(a) * dx + Math.sin(a) * dy; if (s > bd) { bd = s; best = i; } });
  return best;
}

/**
 * Per-frame helmet work: charge refills, healing after quiet time and the
 * foes that the Mantle of the Cloud turned to dust.
 */
export function updateHelmet(state: GameState, killEnemy: (en: Entity) => void): void {
  const id = helmetId(state);
  if (!id) return;
  const f = fx(state), now = state.now, p = state.player;
  refill(state);
  if (id === "joseph" || id === "bushp") {
    const quiet = id === "joseph" ? HELMET.josephQuiet : HELMET.bushQuiet;
    const healAt = Math.max(f.helmHealAt ?? quiet, (f.helmTouchAt ?? -999) + quiet);
    f.helmHealAt = healAt;
    if (now >= healAt) {
      f.helmHealAt = now + quiet;
      if (p.hp > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (id === "joseph" ? HELMET.josephHeal : HELMET.bushHeal));
        spawnFx(state, "helmheal", { x: p.pos.x, y: p.pos.y + 2 }, 1.1, { follow: p.id, color: helmetColor(id), big: id === "bushp" ? 1 : 0 });
      }
    }
  }
  if (f.helmDustPending) {
    f.helmDustPending = 0;
    for (const e of [...state.entities.values()]) {
      if (e.team !== "enemy" || !e.data?.helmDust) continue;
      e.data.dustTint = helmetColor("cloud");
      e.hp = 0;
      killEnemy(e);
    }
  }
}

/** Seconds left before the helmet ability is ready again (0 = ready), for the HUD/tests. */
export function helmetCooldownLeft(state: GameState): number {
  return Math.max(0, (state.equipFx?.helmReady ?? 0) - state.now);
}
