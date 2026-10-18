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

function areaHit(state: GameState, h: ChampHelpers, at: Vec2, r: number, dmg: number, knock = 0, color = "fire") {
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
  h.spawn("chaoe", at, 0.45, { r, color, maxTtl: 0.45 });
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

function rot(v: Vec2, a: number): Vec2 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
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
      if (evo >= 3 && count % 3 === 0) {
        for (let i = 0; i < 8; i++) thrown( rot({ x: 1, y: 0 }, (i / 8) * Math.PI * 2), 520, 0.9, { dmg, pierce: 3, art: "stone" });
      } else {
        const n = evo >= 2 ? 2 : 1;
        for (let i = 0; i < n; i++) thrown( rot(delta(state, h, tgt, from), (i - (n - 1) / 2) * 0.15), 560, 0.9, { dmg, pierce: evo >= 2 ? 3 : 1, art: "stone" });
      }
      return true;
    }
    case "heal": {
      const hurt = alliesAndMoses(state)
        .filter((t) => t.hp < t.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      const n = evo >= 2 ? 2 : 1;
      const mul = evo >= 2 ? 2 : 1;
      for (let i = 0; i < Math.min(n, hurt.length); i++) {
        const t = hurt[i];
        const v = delta(state, h, t.pos, ally.pos);
        thrown( v, 340, 3, { heal: t.maxHp * 0.06 * mul, targetId: t.id, art: "heal" });
      }
      // Puah III: a marked healing area near Moses (re-cast every 10 s).
      if (evo >= 3 && state.now >= ((d.zoneNext as number) ?? 0)) {
        d.zoneNext = state.now + 10;
        const p = state.player.pos;
        h.spawn("chzone", { x: p.x + 30, y: p.y + 10 }, 10, { r: 80, healPct: 0.02, color: "heal", maxTtl: 10 });
      }
      return true;
    }
    case "vial": {
      const R = evo >= 2 ? 85 : 55;
      thrown( delta(state, h, tgt, from), 360, 0.9, { dmg, explodeR: R, chain: evo >= 3 ? 2 : 0, art: "vial", stopAt: tgt });
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
  if (ally.kind === "miriam" && evo >= 3) {
    // Miriam III: damaging whirlwinds drifting from the broom's contact point.
    const dir = (d.attackDir as Vec2) ?? { x: ally.facing, y: 0 };
    for (const s of [-0.6, 0.6]) {
      const v = rot(dir, s);
      h.spawn("chzone", contact, 2.5, { r: 42, dps: dmg * 0.8, color: "whirl", vx: v.x * 60, vy: v.y * 60, maxTtl: 2.5 });
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
  // Aaron II/III: 3 / 9 assisting birds orbiting him and pecking enemies.
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
          if (Math.hypot(v.x, v.y) < r) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * (d.healPct as number) * dt);
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
      e.pos.x = o.pos.x + Math.cos(ang) * 46;
      e.pos.y = o.pos.y - 40 + Math.sin(ang) * 16;
      if (state.now >= (d.next as number)) {
        d.next = state.now + 0.9;
        const t = nearest(state, h, o.pos, 3, 260);
        const pick = t[Math.floor(Math.random() * t.length)];
        if (pick) {
          hit(state, h, pick, ((o.data?.lastDmg as number) ?? 10) * 0.25);
          h.spawn("chpeck", pick.pos, 0.25, { maxTtl: 0.25, fx: e.pos.x, fy: e.pos.y });
        }
      }
    }
  }
}

function updateProj(state: GameState, e: Entity, d: Record<string, unknown>, dt: number, h: ChampHelpers) {
  if ((e.ttl ?? 1) <= 0) return;
  // Healing vial: homes in on its ally / Moses and heals on arrival.
  if (d.heal) {
    const t = state.entities.get(d.targetId as number) ?? (d.targetId === state.player.id ? state.player : undefined);
    if (!t || t.data?.downedUntil) { e.ttl = 0; return; }
    const v = delta(state, h, t.pos, e.pos);
    const dd = Math.hypot(v.x, v.y);
    if (dd < 18) {
      t.hp = Math.min(t.maxHp, t.hp + (d.heal as number));
      h.spawn("chaoe", t.pos, 0.45, { r: 26, color: "heal", maxTtl: 0.45 });
      e.ttl = 0;
      return;
    }
    e.pos.x += (v.x / dd) * 340 * dt; e.pos.y += (v.y / dd) * 340 * dt;
    return;
  }
  const previous = { ...e.pos };
  e.pos.x += (d.vx as number) * dt;
  e.pos.y += (d.vy as number) * dt;
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
    if (d.explodeR) { explode(state, e, d, h); e.ttl = 0; return; }
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
    if ((d.pierce as number) <= 0) { e.ttl = 0; return; }
  }
}

function explode(state: GameState, e: Entity, d: Record<string, unknown>, h: ChampHelpers) {
  if (d.exploded) return;
  d.exploded = 1;
  const R = d.explodeR as number;
  areaHit(state, h, e.pos, R, d.dmg as number, (d.knock as number) ?? 0, d.art === "pyramid" ? "crack" : d.art === "vial" ? "vial" : "fire");
  // Shiphrah III: chain explosions at nearby enemies.
  if (d.chain) {
    for (const en of nearest(state, h, e.pos, d.chain as number, 160)) {
      areaHit(state, h, en.pos, R * 0.7, (d.dmg as number) * 0.6, 0, "vial");
    }
  }
}
