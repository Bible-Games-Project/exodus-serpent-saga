// Shop equipment abilities: staff specials, shield specials and footwear
// effects. Timed triggers and auras live here; stat multipliers live in
// loadout.ts. All timings and targets come from the shop specification.
import type { Entity, GameState, Vec2 } from "./types";
import { weaponDamage } from "./loadout";

type SpawnFn = (kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>, team?: Entity["team"]) => Entity;

function fx(state: GameState): Record<string, number> {
  return (state.equipFx ??= {});
}

function nearestEnemies(state: GameState, from: Vec2, n: number, maxDist = 600): Entity[] {
  const list: Array<{ e: Entity; d: number }> = [];
  for (const e of state.entities.values()) {
    if (e.team !== "enemy") continue;
    const d = Math.hypot(e.pos.x - from.x, e.pos.y - from.y);
    if (d <= maxDist) list.push({ e, d });
  }
  list.sort((a, b) => a.d - b.d);
  return list.slice(0, n).map((x) => x.e);
}

// ---------------------------------------------------------------- staffs
/** Staff special cooldown per evolution (seconds). */
export const STAFF_SPECIAL_COOLDOWN = [20, 15, 10] as const;
/** Visual cast: raise and charge, then slam the staff down to the ground. */
export const STAFF_CHARGE_SECONDS = 1;
export const STAFF_SLAM_SECONDS = 0.3;
/** Power / range multiplier per evolution. */
export const STAFF_SPECIAL_SCALE = [1, 1.3, 1.6] as const;
/** Next-attack damage multiplier granted by the blessing staffs. */
export const STAFF_EMPOWER_MUL: Record<string, readonly number[]> = { moses: [1.5, 1.8, 2.2], iron: [1.7, 2.1, 2.6] };

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
    case "iron":
      f.empowered = 1;
      f.empowerMul = STAFF_EMPOWER_MUL[id][evo - 1] ?? 1.5;
      break;
    case "crystal": {
      const r = 120 * sc;
      for (const en of enemiesWithin(state, p, r)) { en.data ??= {}; en.data.axeFreezeUntil = now + 1; }
      spawn("staffburst", { ...p }, 0.6, { r, color: "ice" });
      break;
    }
    case "diamond": {
      const r = 160 * sc;
      for (const en of enemiesWithin(state, p, r, true)) {
        en.data ??= {};
        en.data.slowUntil = Math.max(Number(en.data.slowUntil ?? 0), now + 2);
        en.hp -= 8 * mag;
      }
      spawn("staffburst", { ...p }, 0.7, { r, color: "light", rays: 1 });
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
      break;
    }
    case "bush": {
      // Stone Staff: petrifies the nearest enemy (never Ramses); it crumbles after 3 s.
      const target = nearestEnemies(state, p, 6, 260 * sc).find((e) => e.kind !== "ramses" && !(e.data?.stoneUntil));
      if (target) { target.data ??= {}; target.data.stoneAt = now; target.data.stoneUntil = now + 3; }
      break;
    }
    case "waters":
      // Rotating ring of water around Moses that damages what it crosses.
      spawn("waterorbit", { ...p }, 3 + evo, { r: 80 * sc, dps: 18 * mag, width: 20 });
      break;
    case "light": {
      // Blinds the closest enemies and binds them together for 2 s (never Ramses).
      const group = nearestEnemies(state, p, 2 + evo, 300 * sc).filter((e) => e.kind !== "ramses");
      if (group.length) {
        let cx = 0, cy = 0;
        for (const en of group) { cx += wrapDelta(en.pos.x, p.x, state.worldW); cy += wrapDelta(en.pos.y, p.y, state.worldH); }
        cx = p.x + cx / group.length; cy = p.y + cy / group.length;
        for (const en of group) {
          en.data ??= {};
          en.data.blindUntil = now + 2;
          en.data.glueUntil = now + 2; en.data.glueX = cx; en.data.glueY = cy;
        }
        spawn("staffburst", { x: cx, y: cy }, 0.6, { r: 60 * sc, color: "light" });
      }
      break;
    }
    case "power": {
      // The hand of God strikes the ground in front of Moses and throws foes up.
      const t = nearestEnemies(state, p, 1, 360)[0];
      const at = t ? { ...t.pos } : { x: p.x + state.player.facing * 90, y: p.y };
      spawn("godhand", at, 1, { r: 110 * sc, dmg: 60 * mag, impactAt: now + 0.35, hit: [] });
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
  // Wait for an enemy nearby so the cast is never wasted (blessings need none).
  if (id !== "moses" && id !== "iron" && !nearestEnemies(state, state.player.pos, 1, 420).length) return;
  if ((id === "moses" || id === "iron") && f.empowered) return;
  f.staffVisualAt = state.now;
  f.staffFireAt = state.now + STAFF_CHARGE_SECONDS + STAFF_SLAM_SECONDS;
  f.staffNext = f.staffFireAt + (STAFF_SPECIAL_COOLDOWN[evo - 1] ?? 20);
}

// ---------------------------------------------------------------- shields
/**
 * Shield modifiers to incoming damage. Returns the (possibly reduced or
 * fully blocked) amount. `projectile` marks enemy projectiles.
 */
export function shieldModifyDamage(state: GameState, amount: number, projectile: boolean): number {
  const lo = state.loadout;
  if (!lo || !(amount > 0)) return amount;
  const f = fx(state);
  const id = lo.shield.id, evo = lo.shield.evolution;

  // Protection of Noah: projectile damage reduction.
  if (projectile && id === "noah" && evo >= 2) amount *= evo >= 3 ? 0.6 : 0.75;

  // Shield of Abraham: a sphere absorbs one hit, then recharges.
  if (id === "abraham" && evo >= 2 && state.now >= (f.absorbReadyAt ?? 0)) {
    f.absorbReadyAt = state.now + (evo >= 3 ? 10 : 15);
    return 0;
  }
  // Shield of the Promise: blocks one hit every 20 / 12 s.
  if (id === "promise" && evo >= 2 && state.now >= (f.blockReadyAt ?? 0)) {
    f.blockReadyAt = state.now + (evo >= 3 ? 12 : 20);
    return 0;
  }
  return amount;
}

/** Shield effects that react after damage is actually taken. */
export function shieldOnDamageTaken(state: GameState): void {
  const lo = state.loadout;
  if (!lo) return;
  const f = fx(state);
  f.lastDamageAt = state.now;
  // Shield of Joseph: taking damage grants a speed burst.
  if (lo.shield.id === "joseph" && lo.shield.evolution >= 2) {
    state.speedBoostUntil = Math.max(state.speedBoostUntil ?? 0, state.now + (lo.shield.evolution >= 3 ? 3 : 2));
  }
}

/** Shield of the God of Israel: survive one lethal hit per run. Returns the
 * health to restore, or null when not applicable. */
export function shieldLethalSurvive(state: GameState): number | null {
  const lo = state.loadout;
  if (!lo || lo.shield.id !== "israel" || lo.shield.evolution < 2) return null;
  const f = fx(state);
  if (f.israelUsed) return null;
  f.israelUsed = 1;
  return Math.round(state.player.maxHp * (lo.shield.evolution >= 3 ? 0.35 : 0.2));
}

function updateShield(state: GameState, spawn: SpawnFn, killEnemy: (en: Entity) => void): void {
  const lo = state.loadout;
  if (!lo) return;
  const f = fx(state);
  const p = state.player;
  const id = lo.shield.id, evo = lo.shield.evolution;

  // Burning Bush Protection: fire aura damages nearby enemies.
  if (id === "bushp" && evo >= 2) {
    const r = evo >= 3 ? 110 : 75;
    const dps = (evo >= 3 ? 14 : 8) * (weaponDamage(state) / 0.5);
    for (const en of nearestEnemies(state, p.pos, 12, r)) {
      en.hp -= dps * (1 / 60);
      if (evo >= 3) { en.data ??= {}; en.data.burnUntil = state.now + 1.5; }
      if (en.hp <= 0) killEnemy(en);
    }
  }
  // Mantle of Jacob / Mantle of the Cloud: destroy incoming projectiles.
  if ((id === "jacobm" || id === "cloud") && evo >= 2) {
    const r = id === "cloud" ? (evo >= 3 ? 120 : 90) : (evo >= 3 ? 100 : 70);
    const behindOnly = id === "jacobm";
    for (const e of [...state.entities.values()]) {
      if (e.team !== "projectile" || (e.dmg ?? 0) <= 0) continue;
      if (["wpnproj", "wpboom", "wpring", "staffflame"].includes(e.kind)) continue; // ours
      const dx = e.pos.x - p.pos.x, dy = e.pos.y - p.pos.y;
      if (Math.hypot(dx, dy) > r) continue;
      if (behindOnly && Math.sign(dx || p.facing) === p.facing) continue;
      spawn("shieldpuff", { ...e.pos }, 0.25, { seed: e.id });
      state.entities.delete(e.id);
    }
  }
  // Light of the Covenant: repel enemies when health falls below 30%.
  if (id === "covenant" && evo >= 2 && p.hp < p.maxHp * 0.3 && state.now >= (f.repelNext ?? 0)) {
    f.repelNext = state.now + 10;
    const r = evo >= 3 ? 220 : 150;
    for (const en of nearestEnemies(state, p.pos, 20, r)) {
      const dx = en.pos.x - p.pos.x, dy = en.pos.y - p.pos.y;
      const dd = Math.hypot(dx, dy) || 1;
      en.pos.x += (dx / dd) * 60;
      en.pos.y += (dy / dd) * 60;
      if (evo >= 3) { en.data ??= {}; en.data.slowUntil = state.now + 2; }
    }
    spawn("shockwave", { ...p.pos }, 0.35, { dmg: 0, r, hit: [] });
  }
}

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
  updateShield(state, spawn, killEnemy);
  updateFootwear(state, spawn);
}
