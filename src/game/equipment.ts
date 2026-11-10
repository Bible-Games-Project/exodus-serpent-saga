// Shop equipment abilities: staff specials and footwear (helmets: helmets.ts)
// effects. Timed triggers and auras live here; stat multipliers live in
// loadout.ts. All timings and targets come from the shop specification.
import type { Entity, GameState, Vec2 } from "./types";
import { updateHelmet } from "./helmets";

type SpawnFn = (kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>, team?: Entity["team"]) => Entity;

function fx(state: GameState): Record<string, number> {
  return (state.equipFx ??= {});
}

function nearestEnemies(state: GameState, from: Vec2, n: number, maxDist = 600): Entity[] {
  const list: Array<{ e: Entity; d: number }> = [];
  for (const e of state.entities.values()) {
    if (e.team !== "enemy" || e.data?.sealed) continue;
    const d = Math.hypot(wrapDelta(e.pos.x, from.x, state.worldW), wrapDelta(e.pos.y, from.y, state.worldH));
    if (d <= maxDist) list.push({ e, d });
  }
  list.sort((a, b) => a.d - b.d);
  return list.slice(0, n).map((x) => x.e);
}

/** Stone Staff: turns a foe into a statue on the spot. It stops dead (the engine
 *  pins it to stoneX/stoneY), its pose freezes and every pending order is dropped. */
export function petrify(e: Entity, now: number): void {
  if (e.data?.sealed) return; // a sealed foe fights for Moses
  const d = (e.data ??= {});
  d.stoneAt = now; d.stoneUntil = now + STONE_SECONDS;
  d.stoneX = e.pos.x; d.stoneY = e.pos.y;
  e.vel.x = 0; e.vel.y = 0;
  for (const k of ["knockUntil", "knockVx", "knockVy", "brawlUntil", "brawlFoeId", "brawlHitAt", "brawlStrikeAt", "liftAt", "tgtId", "tgtAt"]) delete d[k];
}

// ---------------------------------------------------------------- staffs
/** Staff special cooldown per evolution (seconds). */
export const STAFF_SPECIAL_COOLDOWN = [20, 15, 10] as const;
/** Visual cast: raise and charge, then slam the staff down to the ground. */
export const STAFF_CHARGE_SECONDS = 1;
export const STAFF_SLAM_SECONDS = 0.3;
/** Power / range multiplier per evolution. */
export const STAFF_SPECIAL_SCALE = [1, 1.3, 1.6] as const;
/** Iron Staff: share of max HP removed from nearby foes, by level. */
export const IRON_MAXHP_CUT = [.25, .5, .75] as const;
export const IRON_RADIUS = 130;
/** Primordial Waters wave: speed (px/s) and base range. */
export const STAFF_WAVE_SPEED = 300;
export const STAFF_WAVE_RANGE = 360;
/** Crystal Staff: how long caught foes stay frozen. */
export const CRYSTAL_FREEZE_SECONDS = 2;
/** Diamond Staff: shards thrown all around, their reach and speed. */
export const DIAMOND_SHARDS = 10;
export const DIAMOND_SHARD_RANGE = 260;
export const DIAMOND_SHARD_SPEED = 420;
/** Diamond Staff: bleeding drains this share of max HP per second, by level, until death. */
export const DIAMOND_BLEED_PCT = [.08, .12, .16] as const;
/** Stone Staff: radius of "nearby" foes; levels petrify 1/3, 2/3 and all of them. */
export const STONE_RADIUS = 130;
export const STONE_SECONDS = 3;
/** Divine Light: how long blinded foes fight each other. */
export const LIGHT_BRAWL_SECONDS = 8;
/** Divine Light: the single beam's height (its cone footprint scales with it). */
export const LIGHT_BEAM_HEIGHT = 260;
export const LIGHT_BEAM_SECONDS = 1.6;
/** God's Power: fist falls for 0.35 s, then its ground crack lingers. */
export const GOD_HAND_SECONDS = 1.7;

function wrapDelta(a: number, b: number, size: number): number {
  let d = a - b;
  if (d > size / 2) d -= size; else if (d < -size / 2) d += size;
  return d;
}
function enemiesWithin(state: GameState, from: Vec2, r: number, includeRamses = false): Entity[] {
  const out: Entity[] = [];
  for (const e of state.entities.values()) {
    if (e.team !== "enemy" || (!includeRamses && e.kind === "ramses")) continue;
    const dx = wrapDelta(e.pos.x, from.x, state.worldW), dy = wrapDelta(e.pos.y, from.y, state.worldH);
    if (Math.hypot(dx, dy) < r + e.radius) out.push(e);
  }
  return out;
}

/** Fires the staff special at the slam beat. Pure game state; visuals read the spawned entities. */
export function fireStaffSpecial(state: GameState, spawn: SpawnFn, id: string, evo: number): void {
  const lo = state.loadout;
  if (!lo) return;
  const f = fx(state);
  const p = state.player.pos;
  const sc = STAFF_SPECIAL_SCALE[evo - 1] ?? 1;
  const mag = 1 + lo.staff.magicPct / 100;
  const now = state.now;
  switch (id) {
    case "moses":
      // The next attack is blessed (see applyBlessing in weapons.ts).
      f.empowered = 1;
      f.blessEvo = evo;
      f.blessId = (f.blessId ?? 0) + 1;
      break;
    case "iron": {
      // Iron Staff: nearby foes permanently lose part of their max HP and keep a metal tint until they die.
      const r = IRON_RADIUS * sc, cut = IRON_MAXHP_CUT[evo - 1] ?? IRON_MAXHP_CUT[0];
      for (const en of enemiesWithin(state, p, r)) {
        en.maxHp = Math.max(1, en.maxHp * (1 - cut));
        en.hp = Math.min(en.hp, en.maxHp);
        en.data ??= {}; en.data.metalAt = now; en.data.metal = 1;
      }
      spawn("staffburst", { ...p }, 0.6, { r, color: "iron" });
      break;
    }
    case "crystal": {
      const r = 120 * sc;
      for (const en of enemiesWithin(state, p, r)) { en.data ??= {}; en.data.axeFreezeUntil = now + CRYSTAL_FREEZE_SECONDS; }
      spawn("staffring", { ...p }, 1, { r, art: "crystal", tint: "water", ttl0: 1, follow: 1 });
      break;
    }
    case "diamond": {
      // Diamond Staff: crystal shards fly out in every direction; whoever they cut bleeds to death.
      const range = DIAMOND_SHARD_RANGE * sc, ttl = range / DIAMOND_SHARD_SPEED;
      const turn = Math.random() * Math.PI * 2;
      for (let i = 0; i < DIAMOND_SHARDS; i++) {
        const a = turn + i / DIAMOND_SHARDS * Math.PI * 2;
        spawn("staffshard", { x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14 }, ttl, {
          vx: Math.cos(a) * DIAMOND_SHARD_SPEED, vy: Math.sin(a) * DIAMOND_SHARD_SPEED, ttl0: ttl,
          dmg: 8 * mag, bleed: DIAMOND_BLEED_PCT[evo - 1] ?? DIAMOND_BLEED_PCT[0], hit: [],
        }, "hazard");
      }
      break;
    }
    case "bronze":
      // Expanding ring of fire for 1 s; every foe it touches burns for 2 s.
      spawn("firering", { ...p }, 1, { r: 130 * sc, dmg: 12 * mag, burn: 1, grow: 1, ttl0: 1, hit: [] });
      break;
    case "fire": {
      // Wind Staff: a gust around Moses pushes enemies away.
      const r = 140 * sc, kb = 90 * sc;
      for (const en of enemiesWithin(state, p, r)) {
        const dx = wrapDelta(en.pos.x, p.x, state.worldW), dy = wrapDelta(en.pos.y, p.y, state.worldH);
        const d = Math.hypot(dx, dy) || 1;
        en.data ??= {};
        en.data.knockVx = (dx / d) * kb / 0.11; en.data.knockVy = (dy / d) * kb / 0.11;
        en.data.knockUntil = now + 0.22;
      }
      spawn("staffburst", { ...p }, 0.6, { r, color: "ice", wind: 1 });
      // A tornado spins up around Moses as the gust leaves, drawn in front of him.
      spawn("stafftornado", { x: p.x, y: p.y + 1 }, 1.1, { ttl0: 1.1, evo });
      break;
    }
    case "bush": {
      // Stone Staff: petrifies 1/3, 2/3 or all of the nearby enemies (never Ramses), nearest first.
      // They crumble after 3 s; enemy champions survive it, only losing health (see engine.ts).
      const near = nearestEnemies(state, p, 999, STONE_RADIUS * sc).filter((e) => e.kind !== "ramses" && !(Number(e.data?.stoneUntil ?? 0) > now));
      const targets = near.slice(0, Math.max(1, Math.ceil(near.length * Math.min(3, evo) / 3)));
      for (const target of targets) petrify(target, now);
      break;
    }
    case "waters": {
      // Primordial Waters: a wave rolls toward the nearest foe, hurting, slowing and carrying off what it crosses.
      const t = nearestEnemies(state, p, 1, 420)[0];
      const ang = t ? Math.atan2(wrapDelta(t.pos.y, p.y, state.worldH), wrapDelta(t.pos.x, p.x, state.worldW)) : (state.player.facing === -1 ? Math.PI : 0);
      const range = STAFF_WAVE_RANGE * sc;
      spawn("staffwave", { x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20 }, range / STAFF_WAVE_SPEED, {
        vx: Math.cos(ang) * STAFF_WAVE_SPEED, vy: Math.sin(ang) * STAFF_WAVE_SPEED, ttl0: range / STAFF_WAVE_SPEED,
        r: 80 * sc, dmg: 30 * mag * sc, sc, hit: [],
      }, "hazard");
      break;
    }
    case "light": {
      // Divine Light: one great beam lands on the nearest foe; everyone its cone touches
      // is blinded and turns on the others (never Ramses). See the stafflight update.
      const t = nearestEnemies(state, p, 1, 420).find((e) => e.kind !== "ramses") ?? nearestEnemies(state, p, 1, 420)[0];
      const at = t ? { ...t.pos } : { x: p.x + state.player.facing * 90, y: p.y };
      spawn("stafflight", at, LIGHT_BEAM_SECONDS, {
        ttl0: LIGHT_BEAM_SECONDS, h: LIGHT_BEAM_HEIGHT * sc, brawlDmg: 6 * mag * sc, hit: [],
      });
      break;
    }
    case "power": {
      // The hand of God strikes the ground in front of Moses and throws foes up.
      const t = nearestEnemies(state, p, 1, 360)[0];
      const at = t ? { ...t.pos } : { x: p.x + state.player.facing * 90, y: p.y };
      spawn("godhand", at, GOD_HAND_SECONDS, { r: 110 * sc, dmg: 60 * mag, impactAt: now + 0.35, hit: [] });
      break;
    }
  }
}

/** Every staff charges a special on its own cooldown (20 / 15 / 10 s by level). */
function updateStaff(state: GameState, spawn: SpawnFn): void {
  const lo = state.loadout;
  if (!lo) return;
  const f = fx(state);
  const id = lo.staff.id, evo = lo.staff.evolution;
  if (!id || id === "none") return;
  if (f.staffFireAt != null) {
    if (state.now >= f.staffFireAt) {
      delete f.staffFireAt;
      fireStaffSpecial(state, spawn, id, evo);
    }
    return;
  }
  f.staffNext ??= state.now + 3;
  if (state.now < f.staffNext) return;
  // Wait for an enemy nearby so the cast is never wasted (the blessing needs none).
  if (id !== "moses" && !nearestEnemies(state, state.player.pos, 1, 420).length) return;
  if (id === "moses" && f.empowered) return;
  f.staffVisualAt = state.now;
  f.staffFireAt = state.now + STAFF_CHARGE_SECONDS + STAFF_SLAM_SECONDS;
  f.staffNext = f.staffFireAt + (STAFF_SPECIAL_COOLDOWN[evo - 1] ?? 20);
}

// ---------------------------------------------------------------- helmets
// Helmet (shop "shield") abilities live in helmets.ts.

// ---------------------------------------------------------------- footwear
function updateFootwear(state: GameState, spawn: SpawnFn): void {
  const lo = state.loadout;
  if (!lo) return;
  const f = fx(state);
  const p = state.player;
  const id = lo.footwear.id;
  const moving = !!(state.input.x || state.input.y);

  // Pilgrim / Joshua: a 1-second boost every 30 / 25 s.
  if ((id === "pilgrim" || id === "joshua") && state.now >= (f.boostNext ?? 10)) {
    f.boostNext = state.now + (id === "joshua" ? 25 : 30);
    state.speedBoostUntil = Math.max(state.speedBoostUntil ?? 0, state.now + 1);
  }
  // Sandals of the Wind: lightly damaging trail while moving.
  if (id === "wind" && moving && state.now >= (f.trailNext ?? 0)) {
    f.trailNext = state.now + 0.3;
    spawn("windtrail", { ...p.pos }, 1.2, { dps: 6, r: 22 });
  }
  // Sandals of the Jordan: footprints that briefly slow enemies.
  if (id === "jordan" && moving && state.now >= (f.printNext ?? 0)) {
    f.printNext = state.now + 0.4;
    spawn("slowprint", { ...p.pos }, 1.6, { r: 24, slow: 1.2 });
  }
  // Burning Bush Boots: repel (no damage) every 20 s.
  if (id === "bushb" && state.now >= (f.repelNext ?? 20)) {
    f.repelNext = state.now + 20;
    for (const en of nearestEnemies(state, p.pos, 16, 130)) {
      const dx = en.pos.x - p.pos.x, dy = en.pos.y - p.pos.y;
      const dd = Math.hypot(dx, dy) || 1;
      en.pos.x += (dx / dd) * 70;
      en.pos.y += (dy / dd) * 70;
    }
    spawn("shockwave", { ...p.pos }, 0.35, { dmg: 0, r: 130, hit: [] });
  }
  // Sandals of the Invisible Path: teleport every 15 s to a sparse area.
  if (id === "invisible" && state.now >= (f.teleNext ?? 15)) {
    f.teleNext = state.now + 15;
    const vw = state.viewport?.w ?? 800, vh = state.viewport?.h ?? 600;
    let best: Vec2 | null = null, bestCount = Infinity;
    for (let i = 0; i < 8; i++) {
      const c = { x: state.camera.x + (Math.random() - 0.5) * vw * 0.7, y: state.camera.y + (Math.random() - 0.5) * vh * 0.7 };
      const n = nearestEnemies(state, c, 99, 120).length;
      if (n < bestCount) { bestCount = n; best = c; }
    }
    if (best) {
      spawn("shieldpuff", { ...p.pos }, 0.3, { seed: 1 });
      p.pos.x = best.x; p.pos.y = best.y;
      spawn("shieldpuff", { ...p.pos }, 0.3, { seed: 2 });
    }
  }
  // Sandals of the Exodus: +20% speed after 5 s without damage.
  if (id === "exodus") {
    const last = f.lastDamageAt ?? -999;
    f.exodusActive = state.now - last >= 5 ? 1 : 0;
  }
}

/** Extra speed multiplier from the Sandals of the Exodus conditional bonus. */
export function exodusSpeedMul(state: GameState): number {
  return state.equipFx?.exodusActive ? 1.2 : 1;
}

/** Messenger's Footwear: coins and gems are attracted from farther away. */
export function footwearMagnetMul(state: GameState): number {
  return state.loadout?.footwear.id === "messenger" ? 1.5 : 1;
}

// ---------------------------------------------------------------- update
export function updateEquipment(state: GameState, spawn: SpawnFn, killEnemy: (en: Entity) => void): void {
  if (!state.loadout) return;
  updateStaff(state, spawn);
  updateHelmet(state, killEnemy);
  updateFootwear(state, spawn);
}
