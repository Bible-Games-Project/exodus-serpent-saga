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
/** Timed staff specials, checked every frame. */
function updateStaff(state: GameState, spawn: SpawnFn): void {
  const lo = state.loadout;
  if (!lo) return;
  const f = fx(state);
  const p = state.player.pos;
  const id = lo.staff.id, evo = lo.staff.evolution;
  // Timed specials share their real trigger beat with the rear-hand casting pose.
  const spawnEntity = spawn;
  const visualSpawn: SpawnFn = (kind, pos, ttl, data, team) => {
    f.staffVisualAt = state.now;
    return spawnEntity(kind, pos, ttl, data, team);
  };
  spawn = visualSpawn;

  // Crystal / Diamond: blind N enemies every 15 s.
  if ((id === "crystal" || id === "diamond") && evo >= 2) {
    if (state.now >= (f.blindNext ?? 0)) {
      f.blindNext = state.now + 15;
      f.staffVisualAt = state.now;
      const n = id === "crystal" ? (evo >= 3 ? 3 : 1) : (evo >= 3 ? 5 : 3);
      const dur = id === "crystal" ? (evo >= 3 ? 4 : 3) : (evo >= 3 ? 4 : 3);
      for (const en of nearestEnemies(state, p, n)) {
        en.data ??= {};
        en.data.blindUntil = state.now + dur;
      }
    }
  }
  // Burning Bronze: ring of fire every 25 / 20 s.
  if (id === "bronze" && evo >= 2) {
    if (state.now >= (f.fireringNext ?? 0)) {
      f.fireringNext = state.now + (evo >= 3 ? 20 : 25);
      spawn("firering", { ...p }, 0.8, {
        r: evo >= 3 ? 150 : 110, dmg: 20 * (1 + lo.staff.magicPct / 100),
        burn: evo >= 3 ? 1 : 0, hit: [],
      });
    }
  }
  // Burning Bush: flames at 3 / 5 enemies every 20 / 18 s.
  if (id === "bush" && evo >= 2) {
    if (state.now >= (f.flamesNext ?? 0)) {
      f.flamesNext = state.now + (evo >= 3 ? 18 : 20);
      const targets = nearestEnemies(state, p, evo >= 3 ? 5 : 3);
      for (const en of targets) {
        const dx = en.pos.x - p.x, dy = en.pos.y - p.y;
        const dd = Math.hypot(dx, dy) || 1;
        spawn("staffflame", { ...p }, 2, {
          vx: (dx / dd) * 300, vy: (dy / dd) * 300,
          dmg: 16 * (1 + lo.staff.magicPct / 100), burn: 1,
        }, "projectile");
      }
    }
  }
  // Primordial Waters: slowing wave every 25 / 20 s.
  if (id === "waters" && evo >= 2) {
    if (state.now >= (f.waveNext ?? 0)) {
      f.waveNext = state.now + (evo >= 3 ? 20 : 25);
      spawn("slowwave", { ...p }, 1.2, {
        r: evo >= 3 ? 260 : 180, dmg: (evo >= 3 ? 24 : 10) * (1 + lo.staff.magicPct / 100),
        slow: 2.5, hit: [],
      });
    }
  }
  // Divine Light / God's Power: lightning strikes every 25 / 20 s.
  if ((id === "light" || id === "power") && evo >= 2) {
    if (state.now >= (f.boltNext ?? 0)) {
      f.boltNext = state.now + (evo >= 3 ? 20 : 25);
      const n = evo >= 3 ? 5 : 3;
      const base = (id === "power" ? (evo >= 3 ? 120 : 70) : (evo >= 3 ? 60 : 35)) * (1 + lo.staff.magicPct / 100);
      for (const en of nearestEnemies(state, p, n, 700)) {
        let dmg = base;
        // Staff of God's Power III wounds Ramses gravely but never one-hits him.
        if (en.kind === "ramses") dmg = Math.min(dmg, en.maxHp * 0.25);
        en.hp -= dmg;
        spawn("lightningstrike", { ...en.pos }, 0.3, { seed: en.id });
        if (en.hp <= 0 && en.kind !== "ramses") en.hp = 0; // engine kill path collects it
      }
    }
  }
}

/** Staff effects that trigger on every plague cast (Iron slow, Fire burns). */
export function staffOnPlagueCast(state: GameState): void {
  const lo = state.loadout;
  if (!lo) return;
  fx(state).staffVisualAt = state.now;
  const p = state.player.pos;
  const id = lo.staff.id, evo = lo.staff.evolution;
  if (id === "iron" && evo >= 2) {
    for (const en of nearestEnemies(state, p, 8, 260)) {
      en.data ??= {};
      en.data.slowUntil = Math.max((en.data.slowUntil as number) ?? 0, state.now + (evo >= 3 ? 2.5 : 1.2));
    }
  }
  if (id === "fire" && evo >= 2) {
    for (const en of nearestEnemies(state, p, 6, 220)) {
      en.data ??= {};
      en.data.burnUntil = state.now + (evo >= 3 ? 4 : 2);
    }
  }
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
