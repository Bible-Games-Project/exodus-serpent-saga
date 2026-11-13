// Shop champion abilities. Each champion's attack kind (allies.ts) and its
// purchased evolution (ally.data.evo, 1-3) select the behaviour here. The
// common ally system in engine.ts still owns movement, targeting, HP, graves
// and revival; this module only resolves attacks and the entities they spawn.
// Visuals for these entities are drawn by drawChampionFx (championFx.ts).
import type { Entity, GameState, Vec2 } from "./types";
import type { AllyDef } from "./allies";

export type ChampHelpers = {
  spawn: (kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>) => Entity;
  killEnemy: (en: Entity) => void;
  wrapDelta: (a: number, b: number, size: number) => number;
};

const CH_KINDS = new Set(["chproj", "chzone", "chbeam", "chaoe", "chbolt", "chward", "chbird", "chpeck"]);
export function isChampionFxKind(kind: string): boolean {
  return CH_KINDS.has(kind);
}

export function champEvo(ally: Entity): number {
  return Math.max(1, Math.min(3, (ally.data?.evo as number) ?? 1));
}

/** Attack cooldown multiplier from the evolution (Zipporah II+ throws more often). */
export function championCooldownMul(ally: Entity): number {
  if (ally.kind === "zipporah" && champEvo(ally) >= 2) return 0.7;
  return 1;
}

// ---------------------------------------------------------------- helpers
function validEnemy(en: Entity, now: number): boolean {
  if (en.team !== "enemy" || en.hp <= 0) return false;
  if (en.kind === "ramses" && (en.data?.seated || en.data?.downedUntil != null)) return false;
  if ((en.data?.convertedUntil as number) > now) return false;
  return true;
}

function delta(state: GameState, h: ChampHelpers, a: Vec2, b: Vec2): Vec2 {
  return { x: h.wrapDelta(a.x, b.x, state.worldW), y: h.wrapDelta(a.y, b.y, state.worldH) };
}

function nearest(state: GameState, h: ChampHelpers, from: Vec2, n: number, maxD: number, skip?: Set<number>): Entity[] {
  const out: Array<{ e: Entity; d: number }> = [];
  for (const en of state.entities.values()) {
    if (!validEnemy(en, state.now) || skip?.has(en.id)) continue;
    const v = delta(state, h, en.pos, from);
    const d = Math.hypot(v.x, v.y);
    if (d <= maxD) out.push({ e: en, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, n).map((x) => x.e);
}

function hit(state: GameState, h: ChampHelpers, en: Entity, dmg: number) {
  if (en.hp <= 0) return;
  en.hp -= dmg;
  h.spawn("hitspark", { x: en.pos.x, y: en.pos.y - 14 }, 0.18, { seed: Math.floor(Math.random() * 99999), small: 1, maxTtl: 0.18 });
  if (en.hp <= 0) h.killEnemy(en);
}

function areaHit(state: GameState, h: ChampHelpers, at: Vec2, r: number, dmg: number, knock = 0, color = "fire", fx: Record<string, unknown> = {}) {
  for (const en of [...state.entities.values()]) {
    if (!validEnemy(en, state.now)) continue;
    const v = delta(state, h, en.pos, at);
    const d = Math.hypot(v.x, v.y);
    if (d > r + en.radius) continue;
    if (knock && en.kind !== "ramses") {
      en.data ??= {};
      const k = d > 1 ? d : 1;
      en.data.knockVx = (v.x / k) * knock * 3;
      en.data.knockVy = (v.y / k) * knock * 3;
      en.data.knockUntil = state.now + 0.22;
    }
    hit(state, h, en, dmg);
  }
  const ttl = (fx.maxTtl as number) ?? 0.45;
  h.spawn("chaoe", at, ttl, { r, color, maxTtl: ttl, ...fx });
}

function chainHit(state: GameState, h: ChampHelpers, first: Entity, n: number, dmg: number) {
  const hitSet = new Set<number>([first.id]);
  const pts: Vec2[] = [{ ...first.pos }];
  let cur = first;
  for (let i = 0; i < n; i++) {
    const next = nearest(state, h, cur.pos, 1, 160, hitSet)[0];
    if (!next) break;
    hitSet.add(next.id);
    pts.push({ ...next.pos });
    hit(state, h, next, dmg);
    cur = next;
  }
  if (pts.length > 1) h.spawn("chbolt", first.pos, 0.3, { pts, maxTtl: 0.3 });
}

function proj(h: ChampHelpers, from: Vec2, dir: Vec2, speed: number, ttl: number, data: Record<string, unknown>) {
  const l = Math.hypot(dir.x, dir.y) || 1;
  return h.spawn("chproj", { ...from }, ttl, {
    vx: (dir.x / l) * speed, vy: (dir.y / l) * speed, hit: [] as number[], maxTtl: ttl, ...data,
  });
}

/** How far Zipporah's stones fly at levels I / II / III (world px). */
/** Puah's vial and splash size by level (I, II, III). */
/** Shiphrah's vial size and blast reach (px) by level (I, II, III). */
export const SHIPHRAH_VIAL_SIZE = [0.9, 1.2, 1.55];
export const SHIPHRAH_BLAST_R = [55, 75, 100];
export const PUAH_VIAL_SIZE = [0.6, 0.9, 1.7];
/** Share of the target's max health one vial heals (doubled at level II+). */
export const PUAH_VIAL_HEAL = 0.03;
/** Puah III healing ring left where a vial bursts: 1% max health every 0.1 s inside it. */
export const PUAH_RING_R = 60, PUAH_RING_SECONDS = 4, PUAH_RING_HEAL = 0.1;
/** Half-width / half-height of the ring art on the ground, as a multiple of the zone radius. */
export const PUAH_RING_HALF_W = 1.1 * 2.3 / 2, PUAH_RING_HALF_H = PUAH_RING_HALF_W / 1.51;
export const ZIPPORAH_STONE_REACH = [300, 400, 500];
const STONE_FLIGHT = 1.3; // seconds
/** Seconds a stone takes to fade out at the end of its flight or after its last hit. */
export const STONE_FADE = 0.3;
const STONE_END_SPEED = 0.3; // speed at the end, as a share of the starting speed

function rot(v: Vec2, a: number): Vec2 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** Lets the health bar show that this ally / Moses is being healed (until `until`). */
function markHealed(t: Entity, until: number) {
  t.data ??= {};
  t.data.healFxUntil = Math.max((t.data.healFxUntil as number) ?? 0, until);
}

function alliesAndMoses(state: GameState): Entity[] {
  const out: Entity[] = [state.player];
  for (const id of state.npcs.values()) {
    const n = state.entities.get(id);
    if (n && !n.data?.downedUntil) out.push(n);
  }
  return out;
}

// ---------------------------------------------------------------- attacks
/**
 * Resolves the attack of a shop champion. Returns false for the three classic
 * kinds (broom / water / horn), which the engine resolves itself.
 */
export function resolveChampionAttack(state: GameState, ally: Entity, def: AllyDef, dmg: number, h: ChampHelpers): boolean {
  const d = (ally.data ??= {});
  const evo = champEvo(ally);
  const dir = (d.attackDir as Vec2) ?? { x: ally.facing, y: 0 };
  const tgt = (d.attackTarget as Vec2) ?? { x: ally.pos.x + dir.x * def.range, y: ally.pos.y + dir.y * def.range };
  // Simulation stays at ground coordinates; visual lift follows the original hand.
  const sc = def.sprite.scale ?? 1;
  const from = { x: ally.pos.x + (def.sprite.FX.x - def.sprite.CX) * sc * ally.facing, y: ally.pos.y };
  const lift = (def.sprite.H - def.sprite.FX.y) * sc - 10;
  const thrown = (v: Vec2, speed: number, ttl: number, data: Record<string, unknown>) => proj(h, from, v, speed, ttl, { lift, ...data });
  d.atkCount = ((d.atkCount as number) ?? 0) + 1;
  const count = d.atkCount as number;

  switch (def.attack) {
    case "stone": {
      // Zipporah: 1 / 2 / 3 stones by level, each flying in a straight line
      // (they never curve or chase anyone), farther at each level. They leave
      // the hand fast and slow down as they go.
      const reach = ZIPPORAH_STONE_REACH[evo - 1];
      const speed0 = (2 * reach) / (STONE_FLIGHT * (1 + STONE_END_SPEED));
      for (let i = 0; i < evo; i++) {
        thrown(rot(delta(state, h, tgt, from), (i - (evo - 1) / 2) * 0.15), speed0, STONE_FLIGHT, { dmg, pierce: evo >= 2 ? 3 : 1, art: "stone", liftEnd: 14, slowTo: STONE_END_SPEED });
      }
      return true;
    }
    case "heal": {
      // Puah only throws at allies (Moses and the other champions), the nearest first.
      const dist = (t: Entity) => { const v = delta(state, h, t.pos, ally.pos); return Math.hypot(v.x, v.y); };
      const allies = alliesAndMoses(state).filter((t) => t !== ally).sort((a, b) => dist(a) - dist(b));
      const hurt = allies.filter((t) => t.hp < t.maxHp);
      const n = evo >= 2 ? 2 : 1;
      const mul = evo >= 2 ? 2 : 1;
      // Her vials (and their splash) get bigger at each level; at level III they burst into a healing ring.
      const size = PUAH_VIAL_SIZE[evo - 1];
      const ring = evo >= 3 ? 1 : 0;
      for (let i = 0; i < Math.min(n, hurt.length); i++) {
        const t = hurt[i];
        thrown(delta(state, h, t.pos, ally.pos), 340, 3, { heal: t.maxHp * PUAH_VIAL_HEAL * mul, targetId: t.id, art: "heal", size, ring });
      }
      // Nobody is hurt: she still throws a vial at the nearest ally (it heals nothing).
      if (!hurt.length && allies[0]) thrown(delta(state, h, allies[0].pos, ally.pos), 340, 3, { heal: 0, targetId: allies[0].id, art: "heal", size, ring });
      return true;
    }
    case "vial": {
      // Shiphrah: one vial that bursts on the ground and damages every foe in reach;
      // the vial, its splash and the reach all grow with the level.
      thrown(delta(state, h, tgt, from), 360, 0.9, { dmg, explodeR: SHIPHRAH_BLAST_R[evo - 1], art: "vial", size: SHIPHRAH_VIAL_SIZE[evo - 1], stopAt: tgt });
      return true;
    }
    case "arrow": {
      const n = evo >= 3 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        thrown( rot(delta(state, h, tgt, from), (i - (n - 1) / 2) * 0.18), 640, 0.8, {
          dmg, pierce: 1, art: evo >= 2 ? "firearrow" : "arrow",
          burn: evo >= 2 ? 3 : 0, explodeR: evo >= 3 ? 45 : 0,
        });
      }
      return true;
    }
    case "spear": {
      thrown( delta(state, h, tgt, from), 500, 0.9, { dmg, pierce: 4, art: evo >= 2 ? "espear" : "spear", chainN: evo >= 3 ? 15 : evo >= 2 ? 7 : 0 });
      return true;
    }
    case "pyramid": {
      const R = evo >= 3 ? 105 : 70;
      for (let i = 0; i < evo; i++) {
        const off = i === 0 ? { x: 0, y: 0 } : rot({ x: 55, y: 0 }, (i / evo) * Math.PI * 2 + Math.random());
        const at = { x: tgt.x + off.x, y: tgt.y + off.y };
        thrown( delta(state, h, at, from), 300, 1.2, { dmg, explodeR: R, knock: 90, art: "pyramid", stopAt: at, crack: 1, noContact: 1 });
      }
      return true;
    }
    case "convert": {
      // Jethro I: convert one nearby enemy (never Ramses) for 10 s every 12 s.
      if (state.now >= ((d.convertNext as number) ?? 0)) {
        const c = nearest(state, h, ally.pos, 6, 260).find((e) => e.kind !== "ramses");
        if (c) {
          d.convertNext = state.now + 12;
          c.data ??= {};
          c.data.convertedUntil = state.now + 10;
          c.data.convDps = dmg;
          h.spawn("chaoe", c.pos, 0.5, { r: 30, color: "convert", maxTtl: 0.5 });
        }
      }
      // Jethro II/III: confuse nearby enemies every 8 s / 4 s.
      if (evo >= 2 && state.now >= ((d.confuseNext as number) ?? 0)) {
        d.confuseNext = state.now + (evo >= 3 ? 4 : 8);
        const dur = evo >= 3 ? 10 : 4;
        for (const en of nearest(state, h, ally.pos, 12, 200)) {
          if (en.kind === "ramses") continue;
          en.data ??= {};
          en.data.confusedUntil = state.now + dur;
        }
        h.spawn("chaoe", ally.pos, 0.6, { r: 200, color: "convert", maxTtl: 0.6 });
      }
      return true;
    }
    case "ward": {
      // Ithamar never attacks: he wards himself and the nearest ally / Moses.
      const hits = evo >= 3 ? 8 : evo >= 2 ? 5 : 2;
      const dur = evo >= 3 ? 14 : evo >= 2 ? 10 : 6;
      const others = alliesAndMoses(state).filter((t) => t !== ally)
        .map((t) => ({ t, d: Math.hypot(delta(state, h, t.pos, ally.pos).x, delta(state, h, t.pos, ally.pos).y) }))
        .sort((a, b) => a.d - b.d);
      const targets = [ally, ...(others[0] && others[0].d < 420 ? [others[0].t] : [])];
      for (const t of targets) {
        const td = (t.data ??= {});
        const active = (td.wardUntil as number) > state.now && (td.wardHits as number) > 0;
        if (active || state.now < ((td.wardNext as number) ?? 0)) continue;
        td.wardUntil = state.now + dur;
        td.wardHits = hits;
        td.wardProj = evo >= 2 ? 1 : 0;
        td.wardNext = state.now + dur + 3;
        h.spawn("chward", t.pos, dur, { ownerId: t.id, maxTtl: dur });
      }
      return true;
    }
    case "fireball": {
      if (evo >= 3) thrown( dir, 460, 2.0, { dmg, pierce: 1, rebound: 5, art: "flame", burn: 3 });
      else if (evo >= 2) thrown( dir, 520, 0.8, { dmg, pierce: 99, art: "flameline", burn: 3 });
      else thrown( dir, 420, 0.9, { dmg, pierce: 1, explodeR: 60, art: "fireball" });
      return true;
    }
    case "firering": {
      const r = evo >= 3 ? 105 : 70;
      h.spawn("chzone", ally.pos, 3, { r, dps: dmg, color: "fire", followId: ally.id, maxTtl: 3, burn: 1 });
      return true;
    }
    case "beam": {
      const n = evo >= 3 ? 5 : evo >= 2 ? 3 : 1;
      const base = Math.atan2(dir.y, dir.x);
      for (let i = 0; i < n; i++) {
        h.spawn("chbeam", ally.pos, 1.5, { ownerId: ally.id, angle: base + (i - (n - 1) / 2) * 0.32, len: 300, w: 14, dps: dmg * 1.2, maxTtl: 1.5 });
      }
      return true;
    }
    default:
      return false;
  }
}

/** Evolution extras for the three classic champions (Miriam / Jochebed / Aaron). */
export function classicChampionExtras(state: GameState, ally: Entity, def: AllyDef, dmg: number, contact: Vec2, h: ChampHelpers) {
  const evo = champEvo(ally);
  const d = (ally.data ??= {});
  d.atkCount = ((d.atkCount as number) ?? 0) + 1;
  if (ally.kind === "miriam" && evo >= 2) {
    // Miriam II: one damaging tornado drifting from the broom's contact point; III: two.
    const dir = (d.attackDir as Vec2) ?? { x: ally.facing, y: 0 };
    for (const s of evo >= 3 ? [-0.6, 0.6] : [0]) {
      const v = rot(dir, s);
      h.spawn("chzone", contact, 2.5, { r: 42, dps: dmg * 0.8, color: "whirl", tornado: 1, seed: Math.random() * 6.28, vx: v.x * 60, vy: v.y * 60, maxTtl: 2.5 });
    }
  }
  if (ally.kind === "jochebed" && evo >= 3 && (d.atkCount as number) % 3 === 0) {
    // Jochebed III: circular wave that damages and repels nearby enemies.
    areaHit(state, h, ally.pos, 160, dmg, 110, "water");
  }
}

/** Radius multiplier for Miriam's sweep (II+ reaches farther). */
export function broomRadiusMul(ally: Entity): number {
  return ally.kind === "miriam" && champEvo(ally) >= 2 ? 1.3 : 1;
}

/** Horn knockback multiplier (Aaron III pushes harder). */
export function hornKnockMul(ally: Entity): number {
  return ally.kind === "aaron" && champEvo(ally) >= 3 ? 1.6 : 1;
}

// ---------------------------------------------------------------- per-ally upkeep
/** Called every frame for every live champion before the common ally update. */
export function updateChampionAlly(state: GameState, ally: Entity, dt: number, h: ChampHelpers) {
  const d = (ally.data ??= {});
  if (d.downedUntil || (d.summonUntil && state.now < (d.summonUntil as number))) return;
  const evo = champEvo(ally);
  const dmg = (d.lastDmg as number) ?? 0;
  // Aaron II/III: 3 / 9 birds circling him that peck foes going for him.
  if (ally.kind === "aaron" && evo >= 2) {
    const want = evo >= 3 ? 9 : 3;
    if (!d.birdsSpawned) {
      d.birdsSpawned = 1;
      for (let i = 0; i < want; i++) h.spawn("chbird", ally.pos, 1e9, { ownerId: ally.id, idx: i, n: want, next: state.now + 0.5 + i * 0.12 });
    }
  }
  // Abihu II/III: damaging fire trail while moving.
  if (ally.kind === "abihu" && evo >= 2 && Math.hypot(ally.vel.x, ally.vel.y) > 5 && state.now >= ((d.trailNext as number) ?? 0)) {
    d.trailNext = state.now + 0.35;
    h.spawn("chzone", ally.pos, 2, { r: evo >= 3 ? 28 : 22, dps: dmg * 0.5, color: "fire", maxTtl: 2 });
  }
  void dt;
}

// ---------------------------------------------------------------- wards
/**
 * Ithamar's ward: absorbs one hit (melee always; projectiles from Evolution II).
 * Continuous contact damage within 0.4 s counts as the same hit.
 */
export function wardAbsorb(state: GameState, target: Entity, projectile: boolean): boolean {
  const d = target.data;
  if (!d || !((d.wardUntil as number) > state.now) || !((d.wardHits as number) > 0)) return false;
  if (projectile && !d.wardProj) return false;
  if (state.now < ((d.wardGate as number) ?? 0)) return true;
  d.wardGate = state.now + 0.4;
  d.wardHits = (d.wardHits as number) - 1;
  return true;
}

// ---------------------------------------------------------------- enemy control
/**
 * Jethro's converted / confused enemies. Returns true when the enemy's normal
 * AI (and its damage to Moses and champions) must be skipped this frame.
 */
export function championControlsEnemy(state: GameState, e: Entity, dt: number, h: ChampHelpers): boolean {
  const d = e.data;
  if (!d) return false;
  if ((d.convertedUntil as number) > state.now) {
    // Fights for Moses: walks to the nearest enemy and damages it on contact.
    const t = nearest(state, h, e.pos, 1, 500)[0];
    if (t) {
      const v = delta(state, h, t.pos, e.pos);
      const dd = Math.hypot(v.x, v.y) || 1;
      if (dd > e.radius + t.radius) {
        e.vel.x = (v.x / dd) * 90; e.vel.y = (v.y / dd) * 90;
        e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt;
        e.facing = v.x > 0 ? 1 : -1;
      } else {
        t.hp -= ((d.convDps as number) ?? 10) * dt;
        if (state.now >= ((d.convFx as number) ?? 0)) {
          d.convFx = state.now + 0.3;
          h.spawn("hitspark", { x: t.pos.x, y: t.pos.y - 14 }, 0.18, { seed: t.id, small: 1, maxTtl: 0.18 });
        }
        if (t.hp <= 0) h.killEnemy(t);
      }
    }
    return true;
  }
  if (d.convertedUntil) delete d.convertedUntil;
  if ((d.confusedUntil as number) > state.now) {
    // Wanders aimlessly and harms no one.
    if (state.now >= ((d.confAt as number) ?? 0)) {
      d.confAt = state.now + 0.6 + Math.random() * 0.6;
      d.confAng = Math.random() * Math.PI * 2;
    }
    const a = d.confAng as number;
    e.vel.x = Math.cos(a) * 40; e.vel.y = Math.sin(a) * 40;
    e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt;
    e.facing = e.vel.x > 0 ? 1 : -1;
    return true;
  }
  if (d.confusedUntil) delete d.confusedUntil;
  return false;
}

// ---------------------------------------------------------------- entities
export function updateChampionEntities(state: GameState, dt: number, h: ChampHelpers) {
  for (const e of [...state.entities.values()]) {
    if (!CH_KINDS.has(e.kind)) continue;
    const d = (e.data ??= {});
    if (e.kind === "chproj") updateProj(state, e, d, dt, h);
    else if (e.kind === "chzone") {
      if (d.followId != null) {
        const o = state.entities.get(d.followId as number);
        if (o) { e.pos.x = o.pos.x; e.pos.y = o.pos.y; }
      }
      if (d.vx) { e.pos.x += (d.vx as number) * dt; e.pos.y += (d.vy as number) * dt; }
      const r = d.r as number;
      if (d.healPct) {
        for (const t of alliesAndMoses(state)) {
          const v = delta(state, h, t.pos, e.pos);
          // Puah's ring heals whoever stands on its art (an ellipse); other areas use a circle.
          const inside = d.puahRing ? (v.x / (r * PUAH_RING_HALF_W)) ** 2 + (v.y / (r * PUAH_RING_HALF_H)) ** 2 <= 1 : Math.hypot(v.x, v.y) < r;
          if (inside && t.hp < t.maxHp) {
            markHealed(t, state.now + 0.3);
            t.hp = Math.min(t.maxHp, t.hp + t.maxHp * (d.healPct as number) * dt);
          }
        }
      } else {
        for (const en of [...state.entities.values()]) {
          if (!validEnemy(en, state.now)) continue;
          const v = delta(state, h, en.pos, e.pos);
          if (Math.hypot(v.x, v.y) > r + en.radius) continue;
          en.hp -= ((d.dps as number) ?? 0) * dt;
          if (d.burn) { en.data ??= {}; en.data.burnUntil = state.now + 1.5; }
          if (en.hp <= 0) h.killEnemy(en);
        }
      }
    } else if (e.kind === "chbeam") {
      const o = state.entities.get(d.ownerId as number);
      if (!o || o.data?.downedUntil) { e.ttl = 0; continue; }
      e.pos.x = o.pos.x; e.pos.y = o.pos.y - 24;
      const a = d.angle as number, len = d.len as number;
      const ux = Math.cos(a), uy = Math.sin(a);
      for (const en of [...state.entities.values()]) {
        if (!validEnemy(en, state.now)) continue;
        const v = delta(state, h, en.pos, e.pos);
        const t = Math.max(0, Math.min(len, v.x * ux + v.y * uy));
        if (Math.hypot(v.x - ux * t, v.y - uy * t) > (d.w as number) * 0.5 + en.radius) continue;
        en.hp -= (d.dps as number) * dt;
        if (en.hp <= 0) h.killEnemy(en);
      }
    } else if (e.kind === "chward") {
      const o = state.entities.get(d.ownerId as number);
      const od = o?.data;
      if (!o || !od || !((od.wardHits as number) > 0) || !((od.wardUntil as number) > state.now) || od.downedUntil) { e.ttl = 0; continue; }
      e.pos.x = o.pos.x; e.pos.y = o.pos.y;
      d.hits = od.wardHits;
      // Keeps melee enemies out of the bubble.
      for (const en of state.entities.values()) {
        if (en.team !== "enemy" || en.kind === "ramses") continue;
        const v = delta(state, h, en.pos, o.pos);
        const dd = Math.hypot(v.x, v.y);
        const R = 46 + en.radius;
        if (dd < R && dd > 0.01) { en.pos.x += (v.x / dd) * (R - dd); en.pos.y += (v.y / dd) * (R - dd); }
      }
    } else if (e.kind === "chbird") {
      const o = state.entities.get(d.ownerId as number);
      if (!o) { e.ttl = 0; continue; }
      const ang = state.now * 2.2 + ((d.idx as number) / (d.n as number)) * Math.PI * 2;
      if (o.data?.downedUntil) { e.pos.x = o.pos.x; e.pos.y = o.pos.y - 30; d.hidden = 1; continue; }
      d.hidden = 0;
      updateBird(state, e, d, o, { x: o.pos.x + Math.cos(ang) * 46, y: o.pos.y - 40 + Math.sin(ang) * 16 }, dt, h);
      // Draw order: the near half of the circle (lower on screen) in front of Aaron,
      // the far half behind him, so they look like they fly around him.
      if (d.tgt == null) d.depthY = o.pos.y + (Math.sin(ang) >= 0 ? 1 : -1);
    }
  }
}

/** Foes this close to Aaron that are going for him draw his birds. */
export const BIRD_GUARD_RADIUS = 220;
const BIRD_SPEED = 300;
const birdThreatCache = new Map<number, { at: number; list: Entity[] }>();

/** Live foes near Aaron whose current target is Aaron, nearest first (computed once per frame). */
function birdThreats(state: GameState, h: ChampHelpers, owner: Entity): Entity[] {
  const c = birdThreatCache.get(owner.id);
  if (c && c.at === state.now) return c.list;
  const list = nearest(state, h, owner.pos, 99, BIRD_GUARD_RADIUS).filter((en) => en.data?.tgtId === owner.id);
  birdThreatCache.set(owner.id, { at: state.now, list });
  return list;
}

/** Aaron's birds circle him; when a foe nearby goes for Aaron they fly at it and
 *  peck it in close, hovering around it between pecks, then fly back. */
function updateBird(state: GameState, e: Entity, d: Record<string, unknown>, owner: Entity, home: Vec2, dt: number, h: ChampHelpers) {
  const threats = birdThreats(state, h, owner);
  const t = threats.find((x) => x.id === d.tgt) ?? threats[(d.idx as number) % Math.max(1, threats.length)];
  d.tgt = t?.id;
  if (t) d.depthY = t.pos.y + 2; // pecking: in front of the foe
  const ready = !!t && state.now >= ((d.next as number) ?? 0);
  let goal = home;
  if (t && ready) goal = { x: t.pos.x, y: t.pos.y - 16 };
  else if (t) {
    const a = state.now * 5 + (d.idx as number) * 2.1;
    goal = { x: t.pos.x + Math.cos(a) * 24, y: t.pos.y - 36 + Math.sin(a) * 8 };
  }
  const v = delta(state, h, goal, e.pos);
  const dd = Math.hypot(v.x, v.y);
  if (dd > 0.01) {
    const k = Math.min(dd, BIRD_SPEED * dt) / dd;
    e.pos.x = goal.x - v.x * (1 - k); e.pos.y = goal.y - v.y * (1 - k);
  }
  if (Math.abs(v.x) > 1) d.face = v.x > 0 ? 1 : -1;
  d.diving = ready ? 1 : 0;
  if (t && ready && dd < 14) {
    hit(state, h, t, ((owner.data?.lastDmg as number) ?? 10) * 0.3);
    h.spawn("chpeck", { x: t.pos.x, y: t.pos.y }, 0.3, { maxTtl: 0.3, seed: Math.floor(Math.random() * 999) });
    d.next = state.now + 0.6 + Math.random() * 0.2;
  }
}

function updateProj(state: GameState, e: Entity, d: Record<string, unknown>, dt: number, h: ChampHelpers) {
  if ((e.ttl ?? 1) <= 0) return;
  // Healing vial: homes in on its ally / Moses and heals on arrival.
  if (d.heal != null) {
    const t = state.entities.get(d.targetId as number) ?? (d.targetId === state.player.id ? state.player : undefined);
    if (!t || t.data?.downedUntil) { e.ttl = 0; return; }
    const v = delta(state, h, t.pos, e.pos);
    const dd = Math.hypot(v.x, v.y);
    if (dd < 18) {
      if ((d.heal as number) > 0 && t.hp < t.maxHp) markHealed(t, state.now + 0.7);
      t.hp = Math.min(t.maxHp, t.hp + (d.heal as number));
      const size = (d.size as number) ?? 1;
      if (d.ring) h.spawn("chzone", { x: t.pos.x, y: t.pos.y }, PUAH_RING_SECONDS, { r: PUAH_RING_R, healPct: PUAH_RING_HEAL, color: "heal", maxTtl: PUAH_RING_SECONDS, puahRing: 1, seed: Math.random() * 6.28 });
      else h.spawn("chaoe", t.pos, 0.55, { r: 26 * size, color: "heal", maxTtl: 0.55, splash: 1, seed: Math.random() * 6.28 });
      e.ttl = 0;
      return;
    }
    e.pos.x += (v.x / dd) * 340 * dt; e.pos.y += (v.y / dd) * 340 * dt;
    return;
  }
  const previous = { ...e.pos };
  // Slowing throws: speed falls evenly from full to `slowTo` over the flight.
  let mul = 1;
  if (d.fading) mul = 0.25;
  else if (d.slowTo != null) {
    const f = d.slowTo as number, k = Math.max(0, Math.min(1, 1 - (e.ttl ?? 0) / ((d.maxTtl as number) || 1)));
    mul = 1 - (1 - f) * k;
    d.prog = (k - (1 - f) * k * k / 2) / ((1 + f) / 2); // share of the distance covered
  }
  e.pos.x += (d.vx as number) * mul * dt;
  e.pos.y += (d.vy as number) * mul * dt;
  const movement = delta(state, h, e.pos, previous);
  const segmentDistance = (point: Vec2) => {
    const v = delta(state, h, point, previous);
    const length2 = movement.x ** 2 + movement.y ** 2;
    const t = length2 ? Math.max(0, Math.min(1, (v.x * movement.x + v.y * movement.y) / length2)) : 0;
    return Math.hypot(v.x - movement.x * t, v.y - movement.y * t);
  };
  // Lobbed projectiles land on their target point.
  if (d.stopAt) {
    if (segmentDistance(d.stopAt as Vec2) < 14 || (e.ttl ?? 0) <= dt) { e.pos = { ...(d.stopAt as Vec2) }; explode(state, e, d, h); e.ttl = 0; return; }
  }
  if (d.noContact) return;
  const hitArr = d.hit as number[];
  for (const en of [...state.entities.values()]) {
    if (!validEnemy(en, state.now) || hitArr.includes(en.id)) continue;
    if (segmentDistance(en.pos) > en.radius + 10) continue;
    hitArr.push(en.id);
    if (d.explodeR) {
      // Detonate where the swept path contacted the enemy, not past it.
      e.pos = { ...en.pos }; explode(state, e, d, h); e.ttl = 0; return;
    }
    hit(state, h, en, d.dmg as number);
    if (d.burn) { en.data ??= {}; en.data.burnUntil = state.now + (d.burn as number); }
    if (d.chainN && !d.chained) { d.chained = 1; chainHit(state, h, en, d.chainN as number, (d.dmg as number) * 0.5); }
    if (d.rebound && (d.rebound as number) > 0) {
      d.rebound = (d.rebound as number) - 1;
      const next = nearest(state, h, e.pos, 1, 260, new Set(hitArr))[0];
      if (next) {
        const nv = delta(state, h, next.pos, e.pos);
        const nd = Math.hypot(nv.x, nv.y) || 1;
        const sp = Math.hypot(d.vx as number, d.vy as number);
        d.vx = (nv.x / nd) * sp; d.vy = (nv.y / nd) * sp;
        e.ttl = Math.max(e.ttl ?? 0, 0.8);
        return;
      }
      e.ttl = 0; return;
    }
    d.pierce = ((d.pierce as number) ?? 1) - 1;
    if ((d.pierce as number) <= 0) {
      // Stones drift on a little and fade out instead of vanishing on the spot.
      if (d.art === "stone") { d.noContact = 1; d.fading = 1; e.ttl = Math.min(e.ttl ?? 0, STONE_FADE); return; }
      e.ttl = 0; return;
    }
  }
}

function explode(state: GameState, e: Entity, d: Record<string, unknown>, h: ChampHelpers) {
  if (d.exploded) return;
  d.exploded = 1;
  const R = d.explodeR as number;
  if (d.art === "vial") { areaHit(state, h, e.pos, R, d.dmg as number, 0, "vial", { splash: "shiphrah", maxTtl: 0.55, seed: Math.random() * 6.28 }); return; }
  areaHit(state, h, e.pos, R, d.dmg as number, (d.knock as number) ?? 0, d.art === "pyramid" ? "crack" : "fire");
}
