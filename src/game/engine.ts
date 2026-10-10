import type { Entity, GameState, PlagueId, UpgradeChoice, Vec2 } from "./types";
import { PLAGUES, PLAGUE_ORDER } from "./plagues";
import { ALLY_POOL, ALLY_RETARGET_SECONDS, ALLY_REVIVE_SECONDS, allyDef, type AllyDef } from "./allies";
import { BONUSES, rollBonusKind, damagePlayer, restoreShield, SHIELD_CONFIG, pushNotification, type BonusKind } from "./bonuses";
import { PASSIVES, PASSIVE_ORDER, damageMultiplier, magnetMultiplier, passiveRank, speedMultiplier } from "./passives";
import { ENEMY_DEFS, enemyTick, makeEnemy, pickEnemyKind, KNIGHT_LANCE_DMG } from "./enemies";
import { spawnRamses, tickRamses } from "./ramses";
import { MOSES_ART, MOSES_ATTACK, mosesSwingAngle } from "./mosesGameArt";
import { SOLDIER_PUNCH_DUR } from "./soldierArt";
import { DOG_POUNCE_DUR } from "./dogArt";
import { ARCHER_SHOOT_DUR } from "./archerArt";
import { SPEAR_THROW_DUR } from "./spearSoldierArt";
import { AXE_SWING_DUR } from "./axeSoldierArt";
import { HEAVY_SWING_DUR } from "./heavySoldierArt";
import { WOLF_LEAP_DUR } from "./wolfArt";
import { AGILE_HOP_DUR, AGILE_STAB_DUR } from "./agileSoldierArt";
import { COBRA_STRIKE_DUR } from "./cobraArt";
import { LION_MAUL_DUR } from "./lionArt";
import { MAGE_CAST_DUR } from "./mageArt";
import { CHARIOT_SHOOT_DUR } from "./chariotArt";
import { resolvePlayerDefeat } from "./playerDefeat";
import { weaponMuzzle } from "./muzzles";
import { offscreenEnemySpawn } from "./enemySpawn";

import { playShieldBlock } from "./sfx";
import type { TestMapConfig } from "./types";
import { TEST_ATTACK_ORDER } from "./testMap";



// Basic melee enemies attack from just beside Moses instead of overlapping him.
// `gap` = extra distance beyond the two sprite radii, `from`/`to` = the slice of
// the attack animation during which the blow actually connects.
const MELEE_ATTACKS: Record<string, { key: string; dur: number; gap: number; from: number; to: number }> = {
  soldier: { key: "punchAt", dur: SOLDIER_PUNCH_DUR, gap: 34, from: 0.4, to: 0.62 },
  jackal: { key: "pounceAt", dur: DOG_POUNCE_DUR, gap: 30, from: 0.45, to: 0.75 },
  axesoldier: { key: "axeAt", dur: AXE_SWING_DUR, gap: 34, from: 0.42, to: 0.6 },
  heavysoldier: { key: "heavyAt", dur: HEAVY_SWING_DUR, gap: 36, from: 0.59, to: 0.64 },
  wolf: { key: "leapAt", dur: WOLF_LEAP_DUR, gap: 30, from: 0.32, to: 0.58 },
  agilesoldier: { key: "stabAt", dur: AGILE_STAB_DUR, gap: 30, from: 0.35, to: 0.58 },
  cobra: { key: "strikeAt", dur: COBRA_STRIKE_DUR, gap: 26, from: 0.34, to: 0.55 },
  lion: { key: "maulAt", dur: LION_MAUL_DUR, gap: 30, from: 0.45, to: 0.75 },

};




// ---------- utilities ----------
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------- infinite world wrap ----------
function wrap(v: number, m: number): number {
  const r = v % m;
  return r < 0 ? r + m : r;
}
function wrapDelta(a: number, b: number, m: number): number {
  let d = a - b;
  d = ((d + m / 2) % m + m) % m - m / 2;
  return d;
}
export function wrapPos(state: GameState, p: Vec2): void {
  p.x = wrap(p.x, state.worldW);
  p.y = wrap(p.y, state.worldH);
}
export function wrappedDelta(state: GameState, a: Vec2, b: Vec2): Vec2 {
  return { x: wrapDelta(a.x, b.x, state.worldW), y: wrapDelta(a.y, b.y, state.worldH) };
}
function wrapDist2(state: GameState, a: Vec2, b: Vec2): number {
  const dx = wrapDelta(a.x, b.x, state.worldW);
  const dy = wrapDelta(a.y, b.y, state.worldH);
  return dx * dx + dy * dy;
}


// ---------- state factory ----------
export function createInitialState(test?: TestMapConfig | null): GameState {
  const worldW = 8192; // multiple of 256 for seamless ground tiling
  const worldH = 8192;

  const player: Entity = {
    id: 1,
    pos: { x: worldW / 2, y: worldH / 2 },
    vel: { x: 0, y: 0 },
    radius: 12,
    hp: 100,
    maxHp: 100,
    team: "player",
    facing: 1,
    animT: 0,
    born: 0,
    kind: "moses",
  };
  const state: GameState = {
    now: 0,
    running: true,
    paused: false,
    levelUpPending: null,
    shield: SHIELD_CONFIG.initialMax,
    maxShield: SHIELD_CONFIG.initialMax,
    gameOver: false,
    camera: { x: player.pos.x, y: player.pos.y },
    entities: new Map(),
    nextId: 2,
    player,
    xp: 0,
    level: 1,
    xpToNext: 5,
    kills: 0,
    survivalSeconds: 0,
    plagues: new Map([["staff" as PlagueId, 1]]),
    plagueCooldown: new Map([["staff" as PlagueId, 0.3]]),
    npcs: new Map(),
    nextNpcIndex: 0,
    newPlagues: new Set<PlagueId>(),
    newNpcs: new Set(),
    input: { x: 0, y: 0 },
    worldW,
    worldH,
    passives: {},
    nextCompanionLevel: 5,
    testMap: test ?? undefined,
  };
  state.entities.set(player.id, player);
  const DECOR_RADIUS: Record<string, number> = { palm: 12, rock: 16, pyramid: 44 };
  const obstacles: Array<{ pos: Vec2; r: number }> = [];
  // The Test Map is its own environment: a sparser, more open arena so the
  // selected enemies and attacks stay easy to read. Everything else (tiles,
  // collision, wrapping) is the same shared system.
  const decorCount = test ? 26 : 60;
  for (let i = 0; i < decorCount; i++) {
    const k = Math.random();
    const kind = test
      ? (k < 0.55 ? "palm" : "rock")
      : (k < 0.6 ? "palm" : k < 0.9 ? "rock" : "pyramid");
    let px = 0, py = 0;
    for (let tries = 0; tries < 8; tries++) {
      px = rand(0, worldW);
      py = rand(0, worldH);
      if (Math.hypot(px - player.pos.x, py - player.pos.y) > (test ? 420 : 220)) break;
    }
    const r = DECOR_RADIUS[kind] ?? 0;
    const dec: Entity = {
      id: state.nextId++,
      pos: { x: px, y: py },
      vel: { x: 0, y: 0 },
      radius: 0,
      hp: 1, maxHp: 1,
      team: "decor",
      facing: 1, animT: 0, born: 0,
      kind,
      data: { obstacleRadius: r },
    };
    state.entities.set(dec.id, dec);
    if (r > 0) obstacles.push({ pos: dec.pos, r });
  }
  // Ramses and his throne wait for the first measured viewport so their shared
  // spawn point is guaranteed to sit beyond the actual visible camera area.
  const withRamses = test ? test.ramses : true;
  state.obstacles = obstacles;
  state.ramsesPending = withRamses;
  if (test) applyTestMapConfig(state, test);
  return state;
}

/**
 * Test Map only: hand the session the already-implemented attacks it selected.
 * No damage, cooldown, visual or behaviour value is changed.
 */
function applyTestMapConfig(state: GameState, test: TestMapConfig) {
  const upTo = Math.max(-1, Math.min(TEST_ATTACK_ORDER.length - 1, Math.floor(test.maxAttackIndex)));
  for (let i = 0; i <= upTo; i++) {
    const id = TEST_ATTACK_ORDER[i];
    if (!id || state.plagues.has(id)) continue;
    state.plagues.set(id, 1);
    state.plagueCooldown.set(id, 0.5);
  }
  // Selected champions join through the normal recruitment path.
  for (const id of ALLY_POOL) if (test.champions?.[id]) summonCompanion(state, id);
}





// ---------- modular obstacle collision ----------
function resolveObstacles(pos: Vec2, radius: number, state: GameState) {
  const obs = state.obstacles;
  if (!obs) return;
  for (const o of obs) {
    const dx = pos.x - o.pos.x;
    const dy = pos.y - o.pos.y;
    const min = o.r + radius;
    const d2 = dx * dx + dy * dy;
    if (d2 < min * min && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = o.pos.x + (dx / d) * min;
      pos.y = o.pos.y + (dy / d) * min;
    } else if (d2 <= 0.0001) {
      pos.x += min;
    }
  }
}

function inViewport(state: GameState, pos: Vec2, margin = 40): boolean {
  const vw = state.viewport?.w ?? 800;
  const vh = state.viewport?.h ?? 600;
  return (
    Math.abs(pos.x - state.camera.x) < vw / 2 - margin &&
    Math.abs(pos.y - state.camera.y) < vh / 2 - margin
  );
}

// ---------- pixel-art blood pool builder ----------
function makeBloodPoolCanvas(radius: number): HTMLCanvasElement {
  const size = Math.ceil(radius * 2) + 12;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const cx = size / 2;
  const cy = size / 2;
  const pixel = 3;
  const blobs: Array<[number, number, number]> = [];
  const nBlobs = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < nBlobs; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.55;
    const rr = radius * 0.32 + Math.random() * radius * 0.4;
    blobs.push([Math.cos(a) * r, Math.sin(a) * r, rr]);
  }
  const isInside = (px: number, py: number): number => {
    let minEdge = Infinity;
    let inside = false;
    for (const [bx, by, br] of blobs) {
      const dx = px - cx - bx;
      const dy = py - cy - by;
      const d = Math.hypot(dx, dy);
      if (d < br) inside = true;
      minEdge = Math.min(minEdge, Math.abs(d - br));
    }
    return inside ? minEdge : -minEdge;
  };
  for (let y = 0; y < size; y += pixel) {
    for (let x = 0; x < size; x += pixel) {
      const edge = isInside(x, y);
      const shade = Math.random();
      if (edge >= 0) {
        let color = "#8a1010";
        if (edge < 3) color = shade < 0.55 ? "#4c0606" : "#a02222";
        else if (edge < 6) color = shade < 0.4 ? "#6a0c0c" : "#a02222";
        else if (shade < 0.14) color = "#c02828";
        else if (shade < 0.35) color = "#6a0c0c";
        g.fillStyle = color;
        g.fillRect(x, y, pixel, pixel);
      } else if (edge > -5 && Math.random() < 0.35) {
        g.fillStyle = shade < 0.5 ? "#4c0606" : "#8a1010";
        g.fillRect(x, y, pixel, pixel);
      } else if (edge > -10 && Math.random() < 0.06) {
        g.fillStyle = "#4c0606";
        g.fillRect(x, y, pixel, pixel);
      }
    }
  }
  return c;
}

// ---------- update loop ----------
export function update(state: GameState, dt: number) {
  if (state.paused || state.gameOver || state.levelUpPending) return;
  state.now += dt;
  state.survivalSeconds = state.now;

  if (state.ramsesPending && state.viewport) {
    state.ramsesPending = false;
    spawnRamses(state);
  }

  // Cobra venom: a 5-second damage-over-time effect. Re-bites refresh the timer
  // instead of stacking, and it stops dead when the 5 seconds are up.
  if (state.player.data) {
    const pd = state.player.data;

    const until = (pd.poisonUntil as number) ?? 0;
    if (state.now < until) {
      const dps = (pd.poisonDps as number) ?? 0;
      damagePlayer(state, dps * dt);
      resolvePlayerDefeat(state);
    } else if (pd.poisonUntil != null) {
      delete pd.poisonUntil;
      delete pd.poisonDps;
    }
  }

  // Passive health regeneration — always on, deliberately very slow
  // (0.35 HP/second, ~1 HP every 3 seconds). Stops at full health.
  if (state.player.hp > 0 && state.player.hp < state.player.maxHp) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 0.35 * dt);
  }


  // Screen effect decay
  if (state.screenShake) state.screenShake = Math.max(0, state.screenShake - dt * 20);
  if (state.screenFlash) state.screenFlash = Math.max(0, state.screenFlash - dt * 2);

  // Age & cull floating notifications
  if (state.notifications && state.notifications.length) {
    state.notifications = state.notifications.filter((n) => state.now - n.born < n.ttl);
  }

  // Player movement (speed passive + lightning bonus)
  const p = state.player;
  const speed = 150 * speedMultiplier(state);
  const ix = state.input.x;
  const iy = state.input.y;
  const mag = Math.hypot(ix, iy) || 1;
  p.vel.x = (ix / mag) * speed * (Math.hypot(ix, iy) > 0.05 ? 1 : 0);
  p.vel.y = (iy / mag) * speed * (Math.hypot(ix, iy) > 0.05 ? 1 : 0);
  p.pos.x = wrap(p.pos.x + p.vel.x * dt, state.worldW);
  p.pos.y = wrap(p.pos.y + p.vel.y * dt, state.worldH);
  resolveObstacles(p.pos, p.radius, state);
  if (Math.abs(p.vel.x) > 5) p.facing = p.vel.x > 0 ? 1 : -1;
  p.animT += dt * (Math.hypot(p.vel.x, p.vel.y) > 5 ? 6 : 0);

  // Camera follows with wrapped delta so it never jumps at wrap seams.
  const cdx = wrapDelta(p.pos.x, state.camera.x, state.worldW);
  const cdy = wrapDelta(p.pos.y, state.camera.y, state.worldH);
  const k = Math.min(1, dt * 5);
  state.camera.x = wrap(state.camera.x + cdx * k, state.worldW);
  state.camera.y = wrap(state.camera.y + cdy * k, state.worldH);

  // World bonuses appear periodically for the player to discover.
  tickBonusSpawns(state, dt);



  // Spawn enemies over time
  const minutes = state.now / 60;
  const spawnRate = 0.9 + minutes * 0.6;
  spawnEnemies(state, dt, spawnRate);

  // Ramses boss AI
  tickRamses(state, dt, {
    resolveObstacles: (pos, r) => resolveObstacles(pos, r, state),
    spawnEnemyProjectile: (owner, dir, kind, spd, dmg, ttl) => spawnEnemyProjectile(state, owner, dir, kind, spd, dmg, ttl),
  });

  // Orbiting flies
  syncOrbitFlies(state, dt);

  // Cast plagues
  for (const [id, level] of state.plagues) {
    const cd = (state.plagueCooldown.get(id) ?? 0) - dt;
    if (cd <= 0) {
      // Moses only swings the staff when a foe is actually inside his frontal
      // cone. A swing that HAS started is never cancelled: the hazard entity
      // owns the whole animation, and we simply wait for it to expire.
      if (id === "staff" && (staffSwingActive(state) || !enemyInStaffCone(state))) {
        state.plagueCooldown.set(id, 0);
        continue;
      }
      castPlague(state, id, level);
      const def = PLAGUES[id];
      // White Leprosy rolls a fresh random 10–15 s cooldown after every cast.
      state.plagueCooldown.set(id, id === "leprosy" ? 5 + Math.random() * 2.5 : def.scale(level).cooldown);
    } else {
      state.plagueCooldown.set(id, cd);
    }
  }

  const invuln = state.now < (state.invulnUntil ?? 0);
  const enemySlow = (state.darknessUntil ?? 0) > state.now ? 0.9 : 1;

  // Move entities
  for (const e of state.entities.values()) {
    if (e === p) continue;
    if (e.team === "orbit") continue;
    e.animT += dt * 6;

    if (e.team === "enemy") {
      // A vanished spear (for example after TTL expiry) must never leave a
      // surviving soldier permanently empty-handed.
      if (e.kind === "spearsoldier" && e.data?.spearInFlight != null && !state.entities.has(e.data.spearInFlight as number)) {
        delete e.data.spearInFlight;
      }
      // Free-arm punch animation progress (visual only).
      if (e.kind === "soldier" && e.data?.punchAt != null) {
        const pp = (state.now - (e.data.punchAt as number)) / SOLDIER_PUNCH_DUR;
        if (pp >= 1) { delete e.data.punchAt; delete e.data.punchProgress; }
        else e.data.punchProgress = pp;
      }
      // Archer bow draw + release progress (visual only).
      if (e.kind === "archer" && e.data?.shootAt != null) {
        const pp = (state.now - (e.data.shootAt as number)) / ARCHER_SHOOT_DUR;
        if (pp >= 1) { delete e.data.shootAt; delete e.data.shootProgress; }
        else e.data.shootProgress = pp;
      }
      // Chariot archer draw + release progress (he shoots while still rolling).
      if (e.kind === "chariotarcher" && e.data?.shootAt != null) {
        const pp = (state.now - (e.data.shootAt as number)) / CHARIOT_SHOOT_DUR;
        if (pp >= 1) { delete e.data.shootAt; delete e.data.shootProgress; }
        else e.data.shootProgress = pp;
      }
      // Spear soldier throw progress (visual only; he plants while throwing).
      if (e.kind === "spearsoldier" && e.data?.shootAt != null) {
        const pp = (state.now - (e.data.shootAt as number)) / SPEAR_THROW_DUR;
        if (pp >= 1) { delete e.data.shootAt; delete e.data.shootProgress; }
        else e.data.shootProgress = pp;
      }
      // Axe soldier swing progress (visual only).
      if (e.kind === "axesoldier" && e.data?.axeAt != null) {
        const pp = (state.now - (e.data.axeAt as number)) / AXE_SWING_DUR;
        if (pp >= 1) { delete e.data.axeAt; delete e.data.axeProgress; }
        else e.data.axeProgress = pp;
      }
      // Heavy soldier sword swing progress (visual only; he plants while swinging).
      if (e.kind === "heavysoldier" && e.data?.heavyAt != null) {
        const pp = (state.now - (e.data.heavyAt as number)) / HEAVY_SWING_DUR;
        if (pp >= 1) { delete e.data.heavyAt; delete e.data.heavyProgress; }
        else e.data.heavyProgress = pp;
      }
      // Agile soldier hop progress (visual only).
      if (e.kind === "agilesoldier") {
        const hopAt = (e.data?.hopAt as number | undefined) ?? null;
        if (hopAt == null) delete e.data!.hopProgress;
        else {
          const pp = (state.now - hopAt) / AGILE_HOP_DUR;
          if (pp >= 1) {
            delete e.data!.hopAt;
            delete e.data!.hopProgress;
            e.data!.jumpCount = ((e.data!.jumpCount as number) ?? 0) + 1;
            spawnVisualHazard(state, "agiledust", e.pos, 0.28, {
              seed: e.id * 131 + Math.floor(state.now * 1000), maxTtl: 0.28,
            });
          }
          else e.data!.hopProgress = pp;
        }
      }
      // Agile soldier dagger stab progress (visual only).

      if (e.kind === "agilesoldier" && e.data?.stabAt != null) {
        const pp = (state.now - (e.data.stabAt as number)) / AGILE_STAB_DUR;
        if (pp >= 1) { delete e.data.stabAt; delete e.data.stabProgress; }
        else e.data.stabProgress = pp;
      }
      // Cobra venom strike progress (visual only; the coil stays anchored).
      if (e.kind === "cobra" && e.data?.strikeAt != null) {
        const pp = (state.now - (e.data.strikeAt as number)) / COBRA_STRIKE_DUR;
        if (pp >= 1) { delete e.data.strikeAt; delete e.data.strikeProgress; }
        else e.data.strikeProgress = pp;
      }
      // Wolf leap attack progress (visual only; it plants for the whole leap).

      if (e.kind === "wolf" && e.data?.leapAt != null) {
        const pp = (state.now - (e.data.leapAt as number)) / WOLF_LEAP_DUR;
        if (pp >= 1) { delete e.data.leapAt; delete e.data.leapProgress; }
        else e.data.leapProgress = pp;
      }
      // Lion mauling pounce progress (visual only; it plants for the pounce).
      if (e.kind === "lion" && e.data?.maulAt != null) {
        const pp = (state.now - (e.data.maulAt as number)) / LION_MAUL_DUR;
        if (pp >= 1) { delete e.data.maulAt; delete e.data.maulProgress; }
        else e.data.maulProgress = pp;
      }
      // Sorcerer cast progress (visual only; he plants his feet to cast).
      if (e.kind === "mage" && e.data?.shootAt != null) {
        const pp = (state.now - (e.data.shootAt as number)) / MAGE_CAST_DUR;
        if (pp >= 1) { delete e.data.shootAt; delete e.data.shootProgress; }
        else e.data.shootProgress = pp;
      }
      // Shield soldier brace recoil after blocking a staff blow (visual only).
      if (e.kind === "shieldsoldier" && e.data?.blockAt != null) {
        const pp = (state.now - (e.data.blockAt as number)) / 0.22;
        if (pp >= 1) { delete e.data.blockAt; delete e.data.blockProgress; }
        else e.data.blockProgress = pp;
      }


      // Dog crouch + lunge bite progress (visual only).
      if (e.kind === "jackal" && e.data?.pounceAt != null) {
        const pp = (state.now - (e.data.pounceAt as number)) / DOG_POUNCE_DUR;
        if (pp >= 1) { delete e.data.pounceAt; delete e.data.pounceProgress; }
        else e.data.pounceProgress = pp;
      }

      // White Leprosy wastes the afflicted enemy away; it dies normally.
      if (tickLeprosy(state, e, dt)) continue;
      // Ramses handled separately.
      if (e.kind === "ramses") {
        // still take contact damage handled in tickRamses; skip here.
        continue;
      }
      // pick nearest target (Moses or ally) using wrapped delta
      let targetPos: Vec2 = { x: e.pos.x + wrapDelta(p.pos.x, e.pos.x, state.worldW), y: e.pos.y + wrapDelta(p.pos.y, e.pos.y, state.worldH) };
      let bestD = wrapDist2(state, e.pos, p.pos);
      let targetAlly: Entity | undefined;
      for (const npcId of state.npcs.values()) {
        const n = state.entities.get(npcId);
        if (!n || n.data?.downedUntil) continue;
        if (n.data?.summonUntil && state.now < (n.data.summonUntil as number)) continue;
        const d = wrapDist2(state, e.pos, n.pos);
        if (d < bestD * 0.7) {
          bestD = d;
          targetAlly = n;
          targetPos = { x: e.pos.x + wrapDelta(n.pos.x, e.pos.x, state.worldW), y: e.pos.y + wrapDelta(n.pos.y, e.pos.y, state.worldH) };
        }
      }
      const beforeEnemyMove = { x: e.pos.x, y: e.pos.y };
      enemyTick(state, e, targetPos, dt, {
        baseSlow: enemySlow,
        resolveObstacles: (pos, r) => resolveObstacles(pos, r, state),
        spawnEnemyProjectile: (owner, dir, kind, spd, dmg, ttl) => spawnEnemyProjectile(state, owner, dir, kind, spd, dmg, ttl),
        spawnFx: (kind, pos, ttl, data) => spawnVisualHazard(state, kind, pos, ttl, data),
      });
      const kU = e.data?.knockUntil as number | undefined;
      if (kU != null) {
        if (state.now < kU) {
          const f = (kU - state.now) / 0.22; // eases out to zero
          e.pos.x += (e.data!.knockVx as number) * f * dt;
          e.pos.y += (e.data!.knockVy as number) * f * dt;
        } else delete e.data!.knockUntil;
      }
      wrapPos(state, e.pos);

      // Agile assassination pass: swept against Moses so the fast movement can
      // never tunnel through him. Damage is the existing 12-point contact value,
      // applied once, while the soldier keeps travelling along the locked line.
      if (!invuln && e.kind === "agilesoldier" && e.data?.specialDash && !e.data.specialDashHit) {
        const vx = wrapDelta(e.pos.x, beforeEnemyMove.x, state.worldW);
        const vy = wrapDelta(e.pos.y, beforeEnemyMove.y, state.worldH);
        const px = beforeEnemyMove.x;
        const py = beforeEnemyMove.y;
        const tx = px + wrapDelta(p.pos.x, px, state.worldW);
        const ty = py + wrapDelta(p.pos.y, py, state.worldH);
        const pathLen2 = vx * vx + vy * vy;
        const along = Math.max(0, Math.min(1, ((tx - px) * vx + (ty - py) * vy) / (pathLen2 || 1)));
        const hitX = px + vx * along;
        const hitY = py + vy * along;
        const hitRadius = e.radius + p.radius;
        if ((tx - hitX) ** 2 + (ty - hitY) ** 2 <= hitRadius * hitRadius) {
          e.data.specialDashHit = 1;
          damagePlayer(state, ((e.data.contactDmg as number) ?? 12));
          state.damageImpactKind = "normal";
          spawnVisualHazard(state, "agileslash", { x: hitX, y: hitY - 24 }, 0.24, {
            seed: e.id, maxTtl: 0.24,
            dirX: (e.data.specialDashVx as number) ?? e.facing,
            dirY: (e.data.specialDashVy as number) ?? 0,
          });
          resolvePlayerDefeat(state);
        }
      }

      // ---- melee attack: triggered from beside Moses, damage lands mid-anim ----
      const melee = MELEE_ATTACKS[e.kind];
      const dd = Math.sqrt(wrapDist2(state, e.pos, p.pos));
      if (melee && targetAlly && !(e.kind === "agilesoldier" && e.data?.specialDash)) {
        // Same melee timeline, aimed at the champion this enemy is chasing.
        const n = targetAlly;
        const da = Math.sqrt(wrapDist2(state, e.pos, n.pos));
        const reach = e.radius + n.radius + melee.gap;
        const key = melee.key;
        if (e.data?.[key] == null && da < reach && state.now >= ((e.data?.atkGate as number) ?? 0)) {
          e.data!.atkGate = state.now + melee.dur + 0.3;
          e.data![key] = state.now;
          e.data!.atkHitDone = false;
        }
        if (e.data?.[key] != null) {
          const prog = (state.now - (e.data[key] as number)) / melee.dur;
          if (prog >= melee.from && prog <= melee.to && da < reach + 10) {
            const first = !e.data.atkHitDone;
            e.data.atkHitDone = true;
            damageAlly(state, n, ((e.data?.contactDmg as number) ?? 8) * dt, first ? { x: n.pos.x, y: n.pos.y - 24 } : undefined);
          }
        }
      } else if (melee && !(e.kind === "agilesoldier" && e.data?.specialDash)) {
        const reach = e.radius + p.radius + melee.gap;
        const key = melee.key;
        const active = e.data?.[key] != null;
        if (!invuln && !active && dd < reach && state.now >= ((e.data?.atkGate as number) ?? 0)) {
          e.data!.atkGate = state.now + melee.dur + 0.3;
          e.data![key] = state.now;
          e.data!.atkHitDone = false;
        }
        if (!invuln && e.data?.[key] != null) {
          const prog = (state.now - (e.data[key] as number)) / melee.dur;
          if (prog >= melee.from && prog <= melee.to && dd < reach + 10) {
            const contactDmg = (e.data?.contactDmg as number) ?? 8;
            damagePlayer(state, contactDmg * dt);
            state.damageImpactKind = "normal";
            if (!e.data.atkHitDone) {
              e.data.atkHitDone = true;
              const fdx = wrapDelta(p.pos.x, e.pos.x, state.worldW);
              const fdy = wrapDelta(p.pos.y, e.pos.y, state.worldH);
              const fd = Math.hypot(fdx, fdy) || 1;
              const dog = e.kind === "jackal";
              // contact point sits on Moses' body, on the side the enemy is on
              const mx = p.pos.x - (fdx / fd) * (p.radius - 2);
              const my = p.pos.y - (fdy / fd) * 4 - (dog ? 14 : 24);
              spawnVisualHazard(state, "hitspark", { x: mx, y: my }, 0.18, { seed: e.id, small: 1 });
              spawnVisualHazard(state, "bloodhit", { x: mx, y: my }, 0.45, { seed: e.id, maxTtl: 0.45 });
              if (e.kind === "heavysoldier") {
                spawnVisualHazard(state, "heavyslash", { x: mx, y: my }, 0.3, {
                  seed: e.id,
                  maxTtl: 0.3,
                  dirX: fdx / fd,
                  dirY: fdy / fd,
                });
              }
              if (e.kind === "cobra" && p.data) {
                // Venom: refresh (never stack) a 5-second damage-over-time.
                p.data.poisonUntil = state.now + 5;
                p.data.poisonDps = 10;
              }
            }


            resolvePlayerDefeat(state);
          }
        }
      } else if (!invuln && dd < e.radius + p.radius && !(e.kind === "agilesoldier" && e.data?.specialDash)) {
        // A committed agile dash damages Moses only through its one-time swept
        // hit above; overlapping during the pass never adds contact damage.
        // Contact damage (non-melee kinds keep the original overlap behaviour).
        const contactDmg = (e.data?.contactDmg as number) ?? 8;
        damagePlayer(state, contactDmg * dt);
        state.damageImpactKind = e.kind === "ramses" ? "ramses" : "normal";
        resolvePlayerDefeat(state);
      }

      // ---- spear knight: the lance connects once per pass-through charge ----
      if (!invuln && e.kind === "spearknight" && e.data?.charging && !e.data.lanceHit) {
        const lanceReach = e.radius + p.radius + 22;
        if (dd < lanceReach) {
          e.data.lanceHit = 1;
          damagePlayer(state, KNIGHT_LANCE_DMG);
          state.damageImpactKind = "normal";
          const fdx = wrapDelta(p.pos.x, e.pos.x, state.worldW);
          const fdy = wrapDelta(p.pos.y, e.pos.y, state.worldH);
          const fd = Math.hypot(fdx, fdy) || 1;
          const mx = p.pos.x - (fdx / fd) * (p.radius - 2);
          const my = p.pos.y - (fdy / fd) * 4 - 26;
          spawnVisualHazard(state, "hitspark", { x: mx, y: my }, 0.2, { seed: e.id });
          spawnVisualHazard(state, "bloodhit", { x: mx, y: my }, 0.45, { seed: e.id, maxTtl: 0.45 });
          resolvePlayerDefeat(state);
        }
      }

      for (const npcId of state.npcs.values()) {
        const n = state.entities.get(npcId);
        if (!n || n.data?.downedUntil) continue;
        if (n.data?.summonUntil && state.now < (n.data.summonUntil as number)) continue;
        if (wrapDist2(state, e.pos, n.pos) < (e.radius + n.radius) ** 2) {
          if (!melee) damageAlly(state, n, ((e.data?.contactDmg as number) ?? 8) * dt);
        }
      }

    } else if (e.team === "ally") {
      updateCompanion(state, e, dt);
    } else if (e.team === "projectile") {
      // The living serpent is viewport-bound, not timer-bound: it remains in
      // play for as long as Moses can still see any part of it.
      if (e.kind !== "serpent") e.ttl = (e.ttl ?? 0) - dt;
      if (e.kind !== "serpent" && (e.ttl ?? 0) <= 0) {
          if (e.kind === "fireball") {
          const R = (e.data?.radius as number) ?? 110;
          const fireDmg = e.dmg ?? 60;
          for (const en of state.entities.values()) {
            if (en.team !== "enemy") continue;
            if (dist2(en.pos, e.pos) < R * R) {
              if (en.kind === "ramses") {
                // Ramses takes damage but is never instakilled.
                en.hp -= fireDmg;
              } else {
                en.hp = 0;
              }
              if (en.hp <= 0) killEnemy(state, en);
            }
          }
          spawnVisualHazard(state, "fireexplosion", e.pos, 0.55, { radius: R });
          state.screenShake = Math.max(state.screenShake ?? 0, 10);
        } else if (e.kind === "hailstone") {
          const R = (e.data?.radius as number) ?? 60;
          const freezeDur = (e.data?.freeze as number) ?? 2.5;
          for (const en of state.entities.values()) {
            if (en.team !== "enemy") continue;
            if (dist2(en.pos, e.pos) < R * R) {
              en.hp -= e.dmg ?? 0;
              if (!en.data) en.data = {};
              en.data.freezeUntil = state.now + freezeDur;
              if (en.hp <= 0) killEnemy(state, en);
            }
          }
          spawnVisualHazard(state, "hailimpact", e.pos, 0.45, { radius: R });
        }
        removeProjectile(state, e);
        continue;
      }
      if (e.kind === "frog") {
        const d = e.data!;
        const dur = (d.hopDur as number) ?? 0.7;
        let phase = ((d.hopT as number) ?? 0) + dt;
        if (phase >= dur) {
          phase = 0;
          const a = Math.random() * Math.PI * 2;
          const spd = 170;
          e.vel.x = Math.cos(a) * spd;
          e.vel.y = Math.sin(a) * spd;
          e.facing = e.vel.x > 0 ? 1 : -1;
        }
        d.hopT = phase;
        const norm = phase / dur;
        const airborne = norm > 0.18 && norm < 0.85;
        if (airborne) { e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt; }
      } else {
        e.pos.x += e.vel.x * dt;
        e.pos.y += e.vel.y * dt;
      }

      if (e.kind === "serpent") {
        const vw = state.viewport?.w ?? 800;
        const vh = state.viewport?.h ?? 600;
        const dx = Math.abs(wrapDelta(e.pos.x, state.camera.x, state.worldW));
        const dy = Math.abs(wrapDelta(e.pos.y, state.camera.y, state.worldH));
        // The supplied art is 104x42 on screen. Cull only after the complete
        // snake has crossed an edge, never while any part remains visible.
        const halfDiagonal = Math.hypot(104, 42) / 2;
        if (dx > vw / 2 + halfDiagonal || dy > vh / 2 + halfDiagonal) {
          removeProjectile(state, e);
          continue;
        }
      }

      // Enemy-owned projectile hits player: tested against Moses' whole visible
      // body (feet → head), not just his centre point, and swept over the frame
      // so a fast arrow can never tunnel straight through him.
      if (e.data?.enemyOwned) {
        const hitPt = playerBodyHit(state, e, dt);
        if (!invuln && hitPt) {
          damagePlayer(state, (e.dmg ?? 5));
          const owner = e.ownerId == null ? undefined : state.entities.get(e.ownerId);
          state.damageImpactKind = owner?.kind === "ramses" ? "ramses" : "normal";
          // The Sorcerer's light produces a magical smoke burst, never blood.
          if (e.kind === "magelight") {
            spawnVisualHazard(state, "mageimpact", hitPt, 0.34, { seed: e.id, maxTtl: 0.34 });
          } else {
            spawnVisualHazard(state, "hitspark", hitPt, 0.18, { seed: e.id, small: 1 });
            spawnVisualHazard(state, "bloodhit", hitPt, 0.45, { seed: e.id, maxTtl: 0.45 });
          }
          removeProjectile(state, e);
          resolvePlayerDefeat(state);
        }
        if (!state.entities.has(e.id)) continue;
        // Otherwise the shot can strike a champion's visible body.
        for (const npcId of state.npcs.values()) {
          const n = state.entities.get(npcId);
          if (!n || n.data?.downedUntil) continue;
          if (n.data?.summonUntil && state.now < (n.data.summonUntil as number)) continue;
          const bx = n.pos.x + wrapDelta(e.pos.x, n.pos.x, state.worldW) - n.pos.x;
          const by = e.pos.y - (n.pos.y - 22);
          if (Math.abs(bx) < n.radius + e.radius && Math.abs(by) < 34 + e.radius) {
            damageAlly(state, n, e.dmg ?? 5, { x: e.pos.x, y: e.pos.y });
            removeProjectile(state, e);
            break;
          }
        }
        continue;
      }


      if (e.kind === "hailstone" || e.kind === "fireball") continue;
      const hit = e.data?.hit as Set<number> | undefined;
      const prev = { x: e.pos.x - e.vel.x * dt, y: e.pos.y - e.vel.y * dt };
      const vx = e.pos.x - prev.x, vy = e.pos.y - prev.y;
      const pathLen2 = vx * vx + vy * vy;
      const contacts: Array<{ en: Entity; t: number }> = [];
      for (const en of state.entities.values()) {
        if (en.team !== "enemy") continue;
        if (hit?.has(en.id)) continue;
        const wx = en.pos.x - prev.x, wy = en.pos.y - prev.y;
        const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (pathLen2 || 1)));
        const px = prev.x + vx * t, py = prev.y + vy * t;
        if ((en.pos.x - px) ** 2 + (en.pos.y - py) ** 2 < (en.radius + e.radius) ** 2) contacts.push({ en, t });
      }
      contacts.sort((a, b) => a.t - b.t);
      for (const { en } of contacts) {
        if (en.kind === "shieldsoldier") {
          triggerShieldBlock(state, en, e.pos);
          removeProjectile(state, e);
          break;
        }
        en.hp -= e.dmg ?? 0;
        if (hit) hit.add(en.id);
        if (e.kind === "serpent" && (e.dmg ?? 0) > 0) {
          // Blood bursts at the contact point; the snake keeps moving.
          // Only on a real damaging hit.
          const j = () => (Math.random() - 0.5) * 8;
          const bt = 0.32 + Math.random() * 0.22;
          spawnVisualHazard(state, "bloodhit", { x: (en.pos.x + e.pos.x) / 2 + j(), y: (en.pos.y + e.pos.y) / 2 - 14 + j() }, bt, { seed: Math.floor(Math.random() * 99999), maxTtl: bt, small: Math.random() < 0.5 ? 1 : 0 });
        }
        if (e.data?.boltKind === "allywater") {
          const R = (e.data.splashR as number) ?? 30;
          for (const o of [...state.entities.values()]) {
            if (o.team !== "enemy" || o === en || o.kind === "shieldsoldier") continue;
            if (wrapDist2(state, o.pos, e.pos) < R * R) { o.hp -= (e.dmg ?? 0) * 0.5; if (o.hp <= 0) killEnemy(state, o); }
          }
          spawnVisualHazard(state, "allysplash", e.pos, 0.42, { seed: (e.data.seed as number) ?? 1, radius: R });
          if (en.hp <= 0) killEnemy(state, en);
        }
        if (!e.data?.pierce) { removeProjectile(state, e); break; }
        if (en.hp <= 0) killEnemy(state, en);
      }
    } else if (e.team === "hazard") {
      e.ttl = (e.ttl ?? 0) - dt;
      if (e.ttl <= 0) { removeProjectile(state, e); continue; }
      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;
      const d = e.data!;

      // Staff swing — the hitbox follows the animated staff tip in real time
      // so the visual and collision always match, including enemies overhead.
      if (e.kind === "staffswing") {
        applyStaffSwingHits(state, e, dt);
        continue;
      }
      // Red Sea walls — moving damage walls.
      if (e.kind === "redseawall") {
        applyRedSeaWallHits(state, e);
        continue;
      }
      // Red Sea collision flash — instant central damage burst.
      if (e.kind === "redseaburst") {
        continue;
      }
      // Ramses landing shockwave hazard is purely visual (damage already applied).
      if (e.kind === "firstborncloud") {
        const r = (d.radius as number) ?? 95;
        const seen = (d.seen ??= new Set<number>()) as Set<number>;
        const chance = (d.chance as number) ?? 0.5;
        for (const en of state.entities.values()) {
          if (en.team !== "enemy") continue;
          if (seen.has(en.id)) continue;
          if (dist2(en.pos, e.pos) < r * r) {
            seen.add(en.id);
            if (en.data?.immuneFirstborn) continue;
            if (Math.random() < chance) killEnemy(state, en);
          }
        }
        continue;
      }
      const dps = (d.dps as number) ?? 0;
      if (dps > 0) {
        const tick = 0.35;
        d.tickAcc = ((d.tickAcc as number) ?? tick) + dt;
        if ((d.tickAcc as number) >= tick) {
          d.tickAcc = (d.tickAcc as number) - tick;
          const r = (d.radius as number) ?? 90;
          const target = d.targetKind as string | undefined;
          // Locust swarm is a horizontal band, not a circle.
          const isBand = e.kind === "locustswarm";
          const bw = (d.bandW as number) ?? 0;
          const bh = (d.bandH as number) ?? 0;
          for (const en of state.entities.values()) {
            if (en.team !== "enemy") continue;
            const cat = (en.data?.category as string | undefined) ?? "human";
            if (target === "animal" && cat !== "animal") continue;
            if (target === "human" && cat !== "human") continue;
            let hit = false;
            if (isBand) {
              hit = Math.abs(en.pos.x - e.pos.x) < bw / 2 && Math.abs(en.pos.y - e.pos.y) < bh / 2;
            } else {
              hit = dist2(en.pos, e.pos) < r * r;
            }
            if (hit) {
              en.hp -= dps * tick;
              if (en.hp <= 0) killEnemy(state, en);
            }
          }
        }
      }
    } else if (e.team === "pickup") {
      // XP gems + coins + bonuses (wrapped so magnet works across world seam)
      const magnetR = (60 + state.level * 3) * magnetMultiplier(state);
      const dx = wrapDelta(p.pos.x, e.pos.x, state.worldW);
      const dy = wrapDelta(p.pos.y, e.pos.y, state.worldH);
      const d = Math.hypot(dx, dy);
      if (d < magnetR && d > 0.001) {
        const s = 260;
        e.pos.x = wrap(e.pos.x + (dx / d) * s * dt, state.worldW);
        e.pos.y = wrap(e.pos.y + (dy / d) * s * dt, state.worldH);
      }
      if (d < 16 || (e.kind?.startsWith("bonus_") && d < 34)) {
        if (e.kind === "gem") {
          state.xp += (e.data?.xp as number) ?? 1;
          while (state.xp >= state.xpToNext) levelUp(state);
        } else if (e.kind?.startsWith("bonus_")) {
          const kind = (e.data?.bonusKind as BonusKind) ?? "heart";
          BONUSES[kind].apply(state);
        }
        state.entities.delete(e.id);
      }
    }
  }

  // clean up dead enemies
  for (const e of Array.from(state.entities.values())) {
    if (e.team === "enemy" && e.hp <= 0) killEnemy(state, e);
  }

  // Ramses is untouchable while seated on his throne.
  if (state.ramsesId != null) {
    const r = state.entities.get(state.ramsesId);
    if (r && r.data?.seated) {
      r.hp = r.maxHp;
      // stay locked to throne position
      r.pos.x = r.data.throneX as number;
      r.pos.y = r.data.throneY as number;
    }
  }
}


// ---------- staff hitbox follows swing ----------
function applyStaffSwingHits(state: GameState, sw: Entity, _dt: number) {
  const d = sw.data!;
  // The swing always tracks Moses' CURRENT facing, so the visual staff and the
  // hit cone can never disagree (turning mid-swing flips both together).
  const facing = state.player.facing;
  d.facing = facing;
  sw.facing = facing;

  const dur = (d.dur as number) ?? MOSES_ATTACK.DUR;
  const windup = (d.windup as number) ?? MOSES_ATTACK.WINDUP;
  const fx = (d.maxTtl as number) ?? 0.18;
  // Nothing happens during the wind-up (frames 1-2): the impact — FX, hitbox
  // and damage — starts exactly when the sprite reaches frame 3.
  const elapsed = dur - (sw.ttl ?? 0);
  if (elapsed < windup) return;
  const progress = Math.max(0, Math.min(1, (elapsed - windup) / fx));
  // The hitbox is the staff's real trajectory: the segment from Moses' gripping
  // hand to the crook, using the exact same pivot and angle the renderer uses.
  const ang = mosesSwingAngle(progress);
  const { HAND, TIP, CX, H, PX } = MOSES_ART;
  const cx = state.player.pos.x + (HAND.x - CX) * PX * facing;
  const cy = state.player.pos.y + 8 - (H - HAND.y) * PX;
  const c = Math.cos(ang), s = Math.sin(ang);
  const tipX = cx + (TIP.x * c - TIP.y * s) * PX * facing;
  const tipY = cy + (TIP.x * s + TIP.y * c) * PX;


  const hit = (d.hit ??= new Set<number>()) as Set<number>;
  // Once a shield soldier has caught this swing it is spent: no enemy takes any
  // damage from it, not even the ones standing behind him.
  if (d.blocked) return;
  const stats = PLAGUES.staff.scale(state.plagues.get("staff") ?? 1);
  const dmg = stats.dmg * damageMultiplier(state);
  const tolerance = 14; // segment thickness
  // Frontal cone: same reach as the staff, opening slightly above and below
  // Moses' facing direction so a visually connecting swing always lands.
  const reach = Math.hypot(tipX - cx, tipY - cy) + tolerance;
  const candidates: Array<{ en: Entity; px: number; py: number }> = [];
  for (const en of state.entities.values()) {
    if (en.team !== "enemy") continue;
    if (hit.has(en.id)) continue;
    // Distance from enemy to the staff line segment (cx,cy)-(tipX,tipY)
    const vx = tipX - cx, vy = tipY - cy;
    const wx = en.pos.x - cx, wy = en.pos.y - cy;
    const seglen2 = vx * vx + vy * vy;
    let t = (wx * vx + wy * vy) / (seglen2 || 1);
    t = Math.max(0, Math.min(1, t));
    const px = cx + vx * t, py = cy + vy * t;
    const dd = Math.hypot(en.pos.x - px, en.pos.y - py);
    // Radial melee zone centred on Moses: any direction within staff reach.
    const rx = wrapDelta(en.pos.x, state.player.pos.x, state.worldW);
    const ry = wrapDelta(en.pos.y, state.player.pos.y, state.worldH);
    const inRange = dd < en.radius + tolerance || Math.hypot(rx, ry) < reach * 1.15 + en.radius;
    if (inRange) candidates.push({ en, px, py });
  }

  // A shield soldier in the swing's path stops it dead: metallic clang, sparks,
  // zero damage anywhere.
  const shielded = candidates.find((c) => c.en.kind === "shieldsoldier");
  if (shielded) {
    d.blocked = true;
    triggerShieldBlock(state, shielded.en, state.player.pos);
    return;
  }

  for (const { en, px, py } of candidates) {
    en.hp -= dmg;
    hit.add(en.id);
    // Small pixel-art blood burst on the enemy, at the staff contact point.
    // One of five variations is picked at random so hits never look identical.
    const bx = en.pos.x + (px - en.pos.x) * 0.5;
    const by = en.pos.y - en.radius * 0.6 + (py - en.pos.y) * 0.3;
    spawnVisualHazard(state, "staffblood", { x: bx, y: by }, 0.4, {
      variant: Math.floor(Math.random() * 5),
      seed: Math.floor(Math.random() * 1000),
      dirX: facing,
      maxTtl: 0.4,
    });
    // A committed agile pass cannot be displaced by the staff: contact only
    // affects health and feedback, never its locked trajectory.
    if (!(en.kind === "agilesoldier" && en.data?.specialDash)) {
      const kx = en.pos.x - state.player.pos.x;
      const ky = en.pos.y - state.player.pos.y;
      const kd = Math.hypot(kx, ky) || 1;
      en.pos.x += (kx / kd) * 10;
      en.pos.y += (ky / kd) * 10;
    }
    if (en.hp <= 0) killEnemy(state, en);
  }
}

/** Consume one incoming attack at the Shield Soldier and reuse its metal FX. */
function triggerShieldBlock(state: GameState, shield: Entity, source: Vec2) {
  shield.data ??= {};
  shield.data.blockAt = state.now;
  const sx = shield.pos.x + (source.x - shield.pos.x) * 0.42;
  const sy = shield.pos.y - shield.radius * 1.6;
  spawnVisualHazard(state, "shieldclang", { x: sx, y: sy }, 0.24, {
    seed: Math.floor(Math.random() * 1000),
    maxTtl: 0.24,
  });
  playShieldBlock();
}


/** True while a staff swing hazard is still playing (never interrupt it). */
function staffSwingActive(state: GameState): boolean {
  for (const e of state.entities.values()) if (e.kind === "staffswing") return true;
  return false;
}

/**
 * Is at least one enemy inside Moses' frontal staff cone right now? Uses the
 * same geometry as applyStaffSwingHits, sampled at the swing's peak.
 */
function enemyInStaffCone(state: GameState): boolean {
  const facing = state.player.facing;
  const { HAND, TIP, CX, H, PX } = MOSES_ART;
  const cx = state.player.pos.x + (HAND.x - CX) * PX * facing;
  const cy = state.player.pos.y + 8 - (H - HAND.y) * PX;
  const ang = mosesSwingAngle(0.5);
  const c = Math.cos(ang), s = Math.sin(ang);
  const tipX = cx + (TIP.x * c - TIP.y * s) * PX * facing;
  const tipY = cy + (TIP.x * s + TIP.y * c) * PX;
  const reach = Math.hypot(tipX - cx, tipY - cy) + 14;
  for (const en of state.entities.values()) {
    if (en.team !== "enemy") continue;
    const ex = wrapDelta(en.pos.x, state.player.pos.x, state.worldW);
    const ey = wrapDelta(en.pos.y, state.player.pos.y, state.worldH);
    if (Math.hypot(ex, ey) < reach * 1.15 + en.radius) return true;
  }
  return false;
}

// ---------- red sea walls ----------
function applyRedSeaWallHits(state: GameState, wall: Entity) {
  const d = wall.data!;
  const hit = (d.hit ??= new Set<number>()) as Set<number>;
  const dmg = (d.dmg as number) * damageMultiplier(state);
  const wallW = 60;
  for (const en of state.entities.values()) {
    if (en.team !== "enemy") continue;
    if (hit.has(en.id)) continue;
    if (Math.abs(en.pos.x - wall.pos.x) < wallW && Math.abs(en.pos.y - wall.pos.y) < (d.height as number)) {
      en.hp -= dmg;
      hit.add(en.id);
      if (en.hp <= 0) killEnemy(state, en);
    }
  }
}

function spawnEnemies(state: GameState, dt: number, ratePerSec: number) {
  const chance = ratePerSec * dt;
  if (Math.random() < chance) {
    const kind = pickEnemyKind(state);
    if (!kind) return;
    const def = ENEMY_DEFS[kind];
    const e = makeEnemy(state, kind, offscreenEnemySpawn(state, def.radius * 2));
    state.entities.set(e.id, e);
  }
}

/**
 * Moses' body box (feet → head) tested against a projectile's path this frame.
 * Returns the contact point, or null when nothing touched him.
 */
/**
 * Half-extent of what the projectile actually *draws*, so hit detection always
 * matches the pixels on screen. The sorcerer's ball of light is stamped out to
 * 3 art pixels of 3px (±9px) — its old 6px collider was smaller than the art,
 * which is why a ball could visibly touch Moses without registering.
 */
function projectileVisualRadius(e: Entity): number {
  switch (e.kind) {
    case "magelight": return 9;
    case "magebolt": return 9;
    default: return e.radius ?? 4;
  }
}

/**
 * Swept world-space test of a projectile against Moses' whole visible body
 * (feet -> head), padded by the projectile's drawn size on both axes and
 * sub-stepped finely enough that a fast shot can never tunnel through him.
 * World wrapping is respected, so the check is never thrown off near a seam.
 */
function playerBodyHit(state: GameState, e: Entity, dt: number): Vec2 | null {
  const p = state.player;
  const r = projectileVisualRadius(e);
  const halfW = 13 + r;
  const top = p.pos.y - 58 - r;
  const bottom = p.pos.y + 8 + r;
  const prevX = e.pos.x - e.vel.x * dt;
  const prevY = e.pos.y - e.vel.y * dt;
  const travel = Math.hypot(e.pos.x - prevX, e.pos.y - prevY);
  // One sample every 3 world px at most — no frame-rate dependent gaps.
  const steps = Math.max(4, Math.min(64, Math.ceil(travel / 3)));
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const x = prevX + (e.pos.x - prevX) * t;
    const y = prevY + (e.pos.y - prevY) * t;
    const dx = wrapDelta(x, p.pos.x, state.worldW);
    const dy = wrapDelta(y, p.pos.y, state.worldH);
    if (Math.abs(dx) <= halfW && dy >= top - p.pos.y && dy <= bottom - p.pos.y) {
      return { x, y };
    }
  }
  return null;
}

function spawnEnemyProjectile(state: GameState, owner: Entity, dir: Vec2, kind: string, speed: number, dmg: number, ttl: number) {
  // Every shot leaves the weapon itself — bow string, spear tip, staff crystal —
  // never the middle of the shooter's body.
  const origin = weaponMuzzle(owner);

  const e: Entity = {
    id: state.nextId++,
    pos: { x: origin.x, y: origin.y },
    vel: { x: dir.x * speed, y: dir.y * speed },
    radius: 6,
    hp: 1, maxHp: 1,
    team: "projectile", facing: dir.x > 0 ? 1 : -1,
    animT: 0, born: state.now,
    ttl, dmg,
    ownerId: owner.id,
    kind,
    data: { enemyOwned: true, angle: Math.atan2(dir.y, dir.x) },
  };
  state.entities.set(e.id, e);
  // Sorcerer: magical energy bursts from the staff jewel on the exact frame
  // the ball is created (visual only).
  if (owner.kind === "mage") {
    spawnVisualHazard(state, "magecast", origin, 0.36, {
      seed: e.id * 53, dirX: dir.x, dirY: dir.y, maxTtl: 0.36,
    });
  }
  if (owner.kind === "spearsoldier" && kind === "spear_e") {
    owner.data!.spearInFlight = e.id;
  }
}

/**
 * White Leprosy: strike exactly one enemy — the nearest valid one to Moses.
 * Ramses is never a valid target, and an already-afflicted enemy is skipped so
 * effects can never stack. The affliction itself runs in tickLeprosy.
 */
function castLeprosy(state: GameState, duration: number): void {
  const p = state.player;
  const vw = state.viewport?.w ?? 800;
  const vh = state.viewport?.h ?? 600;
  // Only foes Moses can actually see may be chosen.
  const maxD = Math.hypot(vw, vh) / 2;
  let best: Entity | undefined;
  let bestD = maxD * maxD;
  for (const en of state.entities.values()) {
    if (en.team !== "enemy" || en.kind === "ramses" || en.hp <= 0) continue;
    if (en.data?.leprosyUntil != null) continue;
    const d = wrapDist2(state, en.pos, p.pos);
    if (d < bestD) { bestD = d; best = en; }
  }
  if (!best) return;
  best.data ??= {};
  best.data.leprosyStart = state.now;
  best.data.leprosyUntil = state.now + duration;
  // Enough damage per second to waste the target away over the duration.
  best.data.leprosyDps = Math.max(1, best.hp) / duration;
  state.leprosyGlowStart = state.now;
  state.leprosyGlowUntil = state.now + 0.9;
  const tx = p.pos.x + wrapDelta(best.pos.x, p.pos.x, state.worldW);
  const ty = p.pos.y + wrapDelta(best.pos.y, p.pos.y, state.worldH);
  spawnVisualHazard(state, "leprosybeam", { x: p.pos.x, y: p.pos.y }, 0.45, {
    tx, ty, seed: best.id, maxTtl: 0.45,
  });
}

/** Per-frame White Leprosy affliction: slow wasting damage, then normal death. */
function tickLeprosy(state: GameState, en: Entity, dt: number): boolean {
  const until = en.data?.leprosyUntil as number | undefined;
  if (until == null) return false;
  if (en.kind === "ramses") { delete en.data!.leprosyUntil; return false; }
  en.hp -= ((en.data!.leprosyDps as number) ?? 0) * dt;
  if (en.hp <= 0 || state.now >= until) {
    delete en.data!.leprosyUntil;
    delete en.data!.leprosyStart;
    delete en.data!.leprosyDps;
    killEnemy(state, en);
    return true;
  }
  return false;
}

function removeProjectile(state: GameState, projectile: Entity): void {
  state.entities.delete(projectile.id);
  if (projectile.ownerId == null) return;
  const owner = state.entities.get(projectile.ownerId);
  if (owner?.kind === "spearsoldier" && owner.data?.spearInFlight === projectile.id) {
    delete owner.data.spearInFlight;
  }
}

function castPlague(state: GameState, id: PlagueId, level: number) {
  const def = PLAGUES[id];
  const stats = def.scale(level);
  const dmul = damageMultiplier(state);
  const p = state.player.pos;

  if (id === "leprosy") {
    castLeprosy(state, stats.ttl);
    return;
  }

  if (id === "staff") {
    // Damage handled per-frame in applyStaffSwingHits — spawn hazard only.
    const facing = state.player.facing;
    const range = (def.base.extra?.range ?? 70) + level * 4;
    const halfArc = (def.base.extra?.arc ?? 1.05);
    const sw: Entity = {
      id: state.nextId++,
      pos: { x: p.x, y: p.y },
      vel: { x: 0, y: 0 },
      radius: range,
      hp: 1, maxHp: 1,
      team: "hazard", facing,
      animT: 0, born: state.now,
      // The entity spans the whole attack cycle so the sprite animation can be
      // driven from it; the wind FX + hitbox only live inside the impact window
      // that starts when the sprite reaches frame 3.
      ttl: MOSES_ATTACK.DUR,
      kind: "staffswing",
      data: {
        range, halfArc, facing, dps: 0, staffLen: 60, hit: new Set<number>(),
        dur: MOSES_ATTACK.DUR, windup: MOSES_ATTACK.WINDUP, maxTtl: 0.18,
      },
    };
    state.entities.set(sw.id, sw);
  } else if (id === "serpent") {
    let nearest: Entity | null = null;
    let bestD = Infinity;
    for (const en of state.entities.values()) {
      if (en.team !== "enemy") continue;
      const d2 = dist2(en.pos, p);
      if (d2 < bestD) { bestD = d2; nearest = en; }
    }
    const baseAngle = nearest
      ? Math.atan2(nearest.pos.y - p.y, nearest.pos.x - p.x)
      : (state.player.facing === 1 ? 0 : Math.PI);
    for (let i = 0; i < stats.count; i++) {
      const spread = (i - (stats.count - 1) / 2) * 0.14;
      const ang = baseAngle + spread;
      const e: Entity = {
        id: state.nextId++,
        pos: { x: p.x, y: p.y },
        vel: { x: Math.cos(ang) * stats.speed, y: Math.sin(ang) * stats.speed },
        radius: 10,
        hp: 1, maxHp: 1,
        team: "projectile", facing: Math.cos(ang) > 0 ? 1 : -1,
        animT: 0, born: state.now,
        dmg: stats.dmg * dmul,
        kind: "serpent",
        data: { pierce: 1, hit: new Set<number>(), angle: ang },
      };
      state.entities.set(e.id, e);
    }
  } else if (id === "flies") {
    return;
  } else if (id === "frogs") {
    for (let i = 0; i < stats.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const e: Entity = {
        id: state.nextId++,
        pos: { x: p.x, y: p.y },
        vel: { x: Math.cos(ang) * stats.speed, y: Math.sin(ang) * stats.speed },
        radius: 12,
        hp: 1, maxHp: 1,
        team: "projectile", facing: Math.cos(ang) > 0 ? 1 : -1,
        animT: 0, born: state.now,
        ttl: stats.ttl, dmg: stats.dmg * dmul,
        kind: "frog",
        data: { pierce: 1, hit: new Set<number>(), hopT: 0, hopDur: 0.65 },
      };
      state.entities.set(e.id, e);
    }
  } else if (id === "gnats") {
    const count = Math.max(1, stats.count);
    for (let k = 0; k < count; k++) {
      const ang = Math.random() * Math.PI * 2;
      const radius = (def.base.extra?.radius ?? 55) + level * 4;
      const lobes: Array<{ cx: number; cy: number; r: number }> = [];
      const nLobes = 4 + Math.floor(Math.random() * 4);
      for (let li = 0; li < nLobes; li++) {
        const la = Math.random() * Math.PI * 2;
        const lr = Math.random() * radius * 0.85;
        lobes.push({ cx: Math.cos(la) * lr, cy: Math.sin(la) * lr * 0.75, r: radius * (0.28 + Math.random() * 0.4) });
      }
      const particles: Array<{ ox: number; oy: number; phase: number; amp: number }> = [];
      const nP = 40 + Math.floor(Math.random() * 18);
      for (let i = 0; i < nP; i++) {
        const lobe = lobes[Math.floor(Math.random() * lobes.length)];
        const rr = Math.sqrt(Math.random()) * lobe.r;
        const aa = Math.random() * Math.PI * 2;
        particles.push({ ox: lobe.cx + Math.cos(aa) * rr, oy: lobe.cy + Math.sin(aa) * rr, phase: Math.random() * Math.PI * 2, amp: 2 + Math.random() * 4 });
      }
      const e: Entity = {
        id: state.nextId++,
        pos: { x: p.x, y: p.y },
        vel: { x: Math.cos(ang) * stats.speed, y: Math.sin(ang) * stats.speed },
        radius,
        hp: 1, maxHp: 1,
        team: "hazard", facing: 1,
        animT: Math.random() * 10, born: state.now,
        ttl: stats.ttl,
        kind: "gnatswarm",
        data: { radius, dps: stats.dmg * dmul, tickAcc: 0, particles, lobes, maxTtl: stats.ttl },
      };
      state.entities.set(e.id, e);
    }
  } else if (id === "blood") {
    const radius = Math.round(((def.base.extra?.radius ?? 65) + level * 4) * 0.5);
    const canvas = makeBloodPoolCanvas(radius);
    const vw = state.viewport?.w ?? 800;
    const vh = state.viewport?.h ?? 600;
    const margin = radius + 12;
    const artHalf = canvas.width / 2;
    const screenMargin = artHalf + 4;
    const halfW = Math.max(0, vw / 2 - screenMargin);
    const halfH = Math.max(0, vh / 2 - screenMargin);
    let px = state.camera.x + rand(-halfW, halfW);
    let py = state.camera.y + rand(-halfH, halfH);
    px = clamp(px, margin, state.worldW - margin);
    py = clamp(py, margin, state.worldH - margin);
    const e: Entity = {
      id: state.nextId++,
      pos: { x: px, y: py },
      vel: { x: 0, y: 0 },
      radius,
      hp: 1, maxHp: 1,
      team: "hazard", facing: 1,
      animT: 0, born: state.now,
      ttl: stats.ttl,
      kind: "bloodpool",
      data: { radius, dps: stats.dmg * dmul, tickAcc: 0, canvas, maxTtl: stats.ttl },
    };
    state.entities.set(e.id, e);
  } else if (id === "livestock") {
    spawnDriftingCloud(state, { kind: "livestockcloud", radius: (def.base.extra?.radius ?? 90), dps: stats.dmg * dmul, ttl: stats.ttl, speed: stats.speed, targetKind: "animal" });
  } else if (id === "boils") {
    spawnDriftingCloud(state, { kind: "boilscloud", radius: (def.base.extra?.radius ?? 85), dps: stats.dmg * dmul, ttl: stats.ttl, speed: stats.speed, targetKind: "human" });
  } else if (id === "hail") {
    const stones = Math.max(1, stats.count);
    const R = (def.base.extra?.radius ?? 70);
    const freeze = (def.base.extra?.freeze ?? 2.5);
    for (let i = 0; i < stones; i++) spawnHailstone(state, { dmg: stats.dmg * dmul, speed: stats.speed, ttl: stats.ttl }, R, freeze);
  } else if (id === "fire") {
    spawnFireball(state, { dmg: stats.dmg * dmul, speed: stats.speed }, def.base.extra?.radius ?? 90);
  } else if (id === "locusts") {
    spawnLocustSwarm(state, { dmg: stats.dmg * dmul, speed: stats.speed, ttl: stats.ttl }, def.base.extra?.radius ?? 130);
  } else if (id === "firstborn") {
    spawnDriftingCloud(state, { kind: "firstborncloud", radius: (def.base.extra?.radius ?? 95), dps: 0, ttl: stats.ttl, speed: stats.speed, chance: def.base.extra?.chance ?? 0.5 });
  } else if (id === "darkness") {
    state.darknessStart = state.now;
    state.darknessUntil = state.now + stats.ttl;
    state.darknessDur = stats.ttl;
  } else if (id === "redsea") {
    castRedSea(state, stats, dmul);
  } else if (id === "pillar") {
    const radius = (def.base.extra?.radius ?? 70) + level * 4;
    for (const en of state.entities.values()) {
      if (en.team !== "enemy") continue;
      if (dist2(en.pos, p) < radius * radius) {
        en.hp -= stats.dmg * dmul;
        if (en.hp <= 0) killEnemy(state, en);
      }
    }
  }
}

// ---------- Red Sea miracle ----------
function castRedSea(state: GameState, stats: { dmg: number; speed: number; ttl: number }, dmul: number) {
  const vw = state.viewport?.w ?? 800;
  const vh = state.viewport?.h ?? 600;
  const cx = state.camera.x;
  const cy = state.camera.y;
  const height = vh + 200;
  // left wall starts left of screen, moves right; right wall mirrors.
  const travel = vw / 2 + 40;
  const dur = travel / stats.speed;
  const leftFrom = cx - vw / 2 - 40;
  const rightFrom = cx + vw / 2 + 40;
  const target = cx;
  const mkWall = (fromX: number, sign: number) => {
    const e: Entity = {
      id: state.nextId++,
      pos: { x: fromX, y: cy },
      vel: { x: sign * stats.speed, y: 0 },
      radius: 30,
      hp: 1, maxHp: 1,
      team: "hazard", facing: 1,
      animT: 0, born: state.now,
      ttl: dur,
      kind: "redseawall",
      data: { dmg: stats.dmg, height: height / 2, hit: new Set<number>(), maxTtl: dur, sign, targetX: target },
    };
    state.entities.set(e.id, e);
  };
  mkWall(leftFrom, +1);
  mkWall(rightFrom, -1);
  // Schedule central collision burst.
  setTimeout(() => {
    if (!state.running || state.paused) return;
    const centerDmg = ((PLAGUES.redsea.base.extra?.centerDmg ?? 220)) * dmul;
    const R = 180;
    for (const en of state.entities.values()) {
      if (en.team !== "enemy") continue;
      if (dist2(en.pos, { x: cx, y: cy }) < R * R) {
        en.hp -= centerDmg;
        if (en.hp <= 0) killEnemy(state, en);
      }
    }
    // AoE across screen for the collision damage baseline too.
    const wideDmg = stats.dmg * dmul;
    for (const en of state.entities.values()) {
      if (en.team !== "enemy") continue;
      if (Math.abs(en.pos.y - cy) < height / 2) {
        en.hp -= wideDmg * 0.5;
        if (en.hp <= 0) killEnemy(state, en);
      }
    }
    spawnVisualHazard(state, "redseaburst", { x: cx, y: cy }, 0.55, { radius: 220, maxTtl: 0.55 });
    state.screenShake = Math.max(state.screenShake ?? 0, 22);
    state.screenFlash = Math.max(state.screenFlash ?? 0, 0.55);
  }, dur * 1000);
}

// ---------- shared: pixel-particle cloud ----------
function buildCloudParticles(radius: number) {
  const lobes: Array<{ cx: number; cy: number; r: number }> = [];
  const nLobes = 4 + Math.floor(Math.random() * 4);
  for (let li = 0; li < nLobes; li++) {
    const la = Math.random() * Math.PI * 2;
    const lr = Math.random() * radius * 0.7;
    lobes.push({ cx: Math.cos(la) * lr, cy: Math.sin(la) * lr * 0.75, r: radius * (0.32 + Math.random() * 0.45) });
  }
  const particles: Array<{ ox: number; oy: number; phase: number; amp: number; size: number }> = [];
  const nP = 60 + Math.floor(Math.random() * 30);
  for (let i = 0; i < nP; i++) {
    const lobe = lobes[Math.floor(Math.random() * lobes.length)];
    const rr = Math.sqrt(Math.random()) * lobe.r;
    const aa = Math.random() * Math.PI * 2;
    particles.push({ ox: lobe.cx + Math.cos(aa) * rr, oy: lobe.cy + Math.sin(aa) * rr, phase: Math.random() * Math.PI * 2, amp: 1.5 + Math.random() * 3.5, size: Math.random() < 0.35 ? 3 : 2 });
  }
  return particles;
}

function spawnDriftingCloud(state: GameState, opts: { kind: string; radius: number; dps: number; ttl: number; speed: number; targetKind?: string; chance?: number }) {
  const p = state.player.pos;
  const ang = Math.random() * Math.PI * 2;
  const spawnR = 220 + Math.random() * 60;
  const particles = buildCloudParticles(opts.radius);
  const driftAng = Math.random() * Math.PI * 2;
  const e: Entity = {
    id: state.nextId++,
    pos: { x: p.x + Math.cos(ang) * spawnR, y: p.y + Math.sin(ang) * spawnR },
    vel: { x: Math.cos(driftAng) * opts.speed, y: Math.sin(driftAng) * opts.speed },
    radius: opts.radius,
    hp: 1, maxHp: 1,
    team: "hazard", facing: 1,
    animT: Math.random() * 10, born: state.now,
    ttl: opts.ttl,
    kind: opts.kind,
    data: { radius: opts.radius, dps: opts.dps, tickAcc: 0, particles, maxTtl: opts.ttl, targetKind: opts.targetKind, chance: opts.chance },
  };
  state.entities.set(e.id, e);
}

function spawnHailstone(state: GameState, stats: { dmg: number; speed: number; ttl: number }, impactRadius = 70, freezeDur = 2.5) {
  const vw = state.viewport?.w ?? 800;
  const vh = state.viewport?.h ?? 600;
  const tx = state.camera.x + rand(-vw / 2 + 40, vw / 2 - 40);
  const ty = state.camera.y + rand(-vh / 2 + 40, vh / 2 - 40);
  const fallDist = 240 + Math.random() * 70;
  const startX = tx - fallDist * 0.3;
  const startY = ty - fallDist;
  const ttl = fallDist / stats.speed;
  const e: Entity = {
    id: state.nextId++,
    pos: { x: startX, y: startY },
    vel: { x: (tx - startX) / ttl, y: (ty - startY) / ttl },
    radius: 8,
    hp: 1, maxHp: 1,
    team: "projectile", facing: 1,
    animT: 0, born: state.now,
    ttl, dmg: stats.dmg,
    kind: "hailstone",
    data: { impactY: ty, radius: impactRadius, freeze: freezeDur },
  };
  state.entities.set(e.id, e);
}

function spawnFireball(state: GameState, stats: { dmg: number; speed: number }, radius: number) {
  const vw = state.viewport?.w ?? 800;
  const vh = state.viewport?.h ?? 600;
  const tx = state.camera.x + rand(-vw / 2 + 60, vw / 2 - 60);
  const ty = state.camera.y + rand(-vh / 2 + 60, vh / 2 - 60);
  const fallDist = 300 + Math.random() * 80;
  const startX = tx - fallDist * 0.4;
  const startY = ty - fallDist;
  const ttl = fallDist / stats.speed;
  const e: Entity = {
    id: state.nextId++,
    pos: { x: startX, y: startY },
    vel: { x: (tx - startX) / ttl, y: (ty - startY) / ttl },
    radius: 10,
    hp: 1, maxHp: 1,
    team: "projectile", facing: 1,
    animT: 0, born: state.now,
    ttl, dmg: stats.dmg,
    kind: "fireball",
    data: { impactY: ty, radius },
  };
  state.entities.set(e.id, e);
}

function spawnVisualHazard(state: GameState, kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>) {
  const e: Entity = {
    id: state.nextId++,
    pos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: 0 },
    radius: 4,
    hp: 1, maxHp: 1,
    team: "hazard", facing: 1,
    animT: 0, born: state.now,
    ttl,
    kind,
    data: { ...data, dps: 0, maxTtl: ttl },
  };
  state.entities.set(e.id, e);
}

function spawnLocustSwarm(state: GameState, stats: { dmg: number; speed: number; ttl: number }, _radius: number) {
  const vw = state.viewport?.w ?? 800;
  const vh = state.viewport?.h ?? 600;
  const cam = state.camera;
  // Horizontal band the width of the visible field, travelling top → bottom.
  const bandW = vw + 120;
  const bandH = 140;
  const sx = cam.x;
  const sy = cam.y - vh / 2 - bandH;
  const ty = cam.y + vh / 2 + bandH;
  const particles: Array<{ ox: number; oy: number; phase: number; amp: number; wing: number; hopPhase: number }> = [];
  const nP = 220 + Math.floor(Math.random() * 80);
  for (let i = 0; i < nP; i++) {
    particles.push({
      ox: (Math.random() - 0.5) * bandW,
      oy: (Math.random() - 0.5) * bandH,
      phase: Math.random() * Math.PI * 2,
      amp: 1.5 + Math.random() * 3,
      wing: Math.random() * Math.PI * 2,
      hopPhase: Math.random() * Math.PI * 2,
    });
  }
  const e: Entity = {
    id: state.nextId++,
    pos: { x: sx, y: sy },
    vel: { x: 0, y: (ty - sy) / stats.ttl },
    radius: Math.max(bandW, bandH) / 2,
    hp: 1, maxHp: 1,
    team: "hazard", facing: 1,
    animT: 0, born: state.now,
    ttl: stats.ttl,
    kind: "locustswarm",
    data: { bandW, bandH, dps: stats.dmg, tickAcc: 0, particles, maxTtl: stats.ttl },
  };
  state.entities.set(e.id, e);
}

// ---------- orbiting flies ----------
function syncOrbitFlies(state: GameState, dt: number) {
  const targetCount = state.plagues.get("flies") ?? 0;
  const ids = (state.orbitFlyIds ??= []);
  for (let i = ids.length - 1; i >= 0; i--) if (!state.entities.has(ids[i])) ids.splice(i, 1);
  while (ids.length < targetCount) {
    const e: Entity = {
      id: state.nextId++,
      pos: { x: state.player.pos.x, y: state.player.pos.y },
      vel: { x: 0, y: 0 },
      radius: 8,
      hp: 1, maxHp: 1,
      team: "orbit", facing: 1,
      animT: Math.random() * 10, born: state.now,
      kind: "fly",
      data: { hitCd: new Map<number, number>() },
    };
    state.entities.set(e.id, e);
    ids.push(e.id);
  }
  while (ids.length > targetCount) {
    const id = ids.pop();
    if (id != null) state.entities.delete(id);
  }
  const count = ids.length;
  if (count === 0) return;
  const def = PLAGUES.flies;
  const dmg = def.scale(targetCount).dmg * damageMultiplier(state);
  const orbitSpeed = 2.4;
  const radius = 58;
  const t = state.now;
  for (let i = 0; i < count; i++) {
    const e = state.entities.get(ids[i]);
    if (!e) continue;
    const a = t * orbitSpeed + (i / count) * Math.PI * 2;
    e.pos.x = state.player.pos.x + Math.cos(a) * radius;
    e.pos.y = state.player.pos.y + Math.sin(a) * radius;
    e.facing = Math.cos(a) > 0 ? 1 : -1;
    e.animT = t * 14;
    const hitCd = e.data!.hitCd as Map<number, number>;
    for (const [k, v] of hitCd) {
      const nv = v - dt;
      if (nv <= 0) hitCd.delete(k); else hitCd.set(k, nv);
    }
    for (const en of state.entities.values()) {
      if (en.team !== "enemy") continue;
      if (hitCd.has(en.id)) continue;
      if (dist2(en.pos, e.pos) < (en.radius + e.radius) ** 2) {
        en.hp -= dmg;
        hitCd.set(en.id, 0.4);
        if (en.hp <= 0) killEnemy(state, en);
      }
    }
  }
}

function killEnemy(state: GameState, e: Entity) {
  // Ramses cannot die from normal death — clamp.
  if (e.kind === "ramses") {
    // Ramses falls into a pyramid tomb and revives after the champion revive time.
    if (e.data && e.data.downedUntil == null) {
      e.hp = 0;
      e.data.downedUntil = state.now + ALLY_REVIVE_SECONDS;
      e.data.downedAt = state.now;
      e.data.leapPhase = "idle"; e.data.atkPhase = "idle";
    }
    return;
  }
  if (!state.entities.has(e.id)) return;
  state.entities.delete(e.id);
  state.kills++;
  spawnVisualHazard(state, "deathpuff", e.pos, 0.48, {
    variant: Math.floor(Math.random() * 6),
    seed: Math.floor(Math.random() * 100000),
    scale: Math.max(0.75, Math.min(1.35, e.radius / 16)),
  });
  const gem: Entity = {
    id: state.nextId++,
    pos: { x: e.pos.x, y: e.pos.y },
    vel: { x: 0, y: 0 },
    radius: 8,
    hp: 1, maxHp: 1,
    team: "pickup", facing: 1,
    animT: 0, born: state.now,
    kind: "gem",
    data: { xp: (e.data?.xp as number) ?? 1 },
  };
  state.entities.set(gem.id, gem);
  // (bonuses now spawn randomly in the world, not from kills)
}

// ---------- world bonus spawner ----------
function tickBonusSpawns(state: GameState, dt: number) {
  let cd = (state.bonusSpawnCd ?? 12) - dt;
  if (cd <= 0) {
    cd = 22 + Math.random() * 18;
    // count current bonuses
    let count = 0;
    for (const e of state.entities.values()) {
      if (e.team === "pickup" && typeof e.kind === "string" && e.kind.startsWith("bonus_")) count++;
    }
    if (count < 5) {
      const p = state.player.pos;
      const ang = Math.random() * Math.PI * 2;
      const r = 260 + Math.random() * 260;
      const kind = rollBonusKind();
      const b: Entity = {
        id: state.nextId++,
        pos: { x: wrap(p.x + Math.cos(ang) * r, state.worldW), y: wrap(p.y + Math.sin(ang) * r, state.worldH) },
        vel: { x: 0, y: 0 },
        radius: 14,
        hp: 1, maxHp: 1,
        team: "pickup", facing: 1,
        animT: Math.random() * 10, born: state.now,
        kind: `bonus_${kind}`,
        data: { bonusKind: kind },
      };
      state.entities.set(b.id, b);
    }
  }
  state.bonusSpawnCd = cd;
}


// ---------- allied champions (common system; data in allies.ts) ----------
function allyTargetValid(state: GameState, id: number | undefined): Entity | undefined {
  if (id == null) return undefined;
  const t = state.entities.get(id);
  if (!t || t.team !== "enemy" || t.hp <= 0) return undefined;
  if (t.kind === "ramses" && (t.data?.seated || t.data?.downedUntil != null)) return undefined;
  return t;
}

function updateCompanion(state: GameState, e: Entity, dt: number) {
  const d = e.data!;
  const def = allyDef(e.kind);
  e.vel.x = 0; e.vel.y = 0;
  if (!def) return;
  // Invocation lockout — the champion is untouchable while the summon light plays.
  if (d.summonUntil && state.now < (d.summonUntil as number)) return;
  // Fallen: a grave stays where they fell until the revival timer expires.
  if (d.downedUntil) {
    if (state.now < (d.downedUntil as number)) return;
    d.downedUntil = undefined;
    d.standupUntil = state.now + 0.6;
    e.hp = e.maxHp;
    d.targetId = undefined;
  }
  if (d.standupUntil && state.now < (d.standupUntil as number)) return;
  if (d.standupUntil) d.standupUntil = undefined;

  // Attack timeline in progress: stand still until it finishes.
  if (d.attackT != null) {
    const prevT = d.attackT as number;
    const t = Math.max(0, prevT - dt);
    d.attackT = t;
    const total = def.windup + def.action;
    const impactAt = total - def.windup - def.action * (def.impactFrac ?? 0);
    if (!d.attackResolved && t <= impactAt) {
      resolveAllyAttack(state, e, def);
      d.attackResolved = true;
    }
    if (t <= 0) delete d.attackT;
    return;
  }

  // Off-screen recovery: walk back toward the player's visible area (camera
  // centre), never teleport. Normal behaviour resumes once visible again.
  if (!inViewport(state, e.pos, 0)) {
    const dx = wrapDelta(state.camera.x, e.pos.x, state.worldW);
    const dy = wrapDelta(state.camera.y, e.pos.y, state.worldH);
    const dd = Math.hypot(dx, dy) || 1;
    const spd = def.moveSpeed * 1.6;
    e.vel.x = (dx / dd) * spd; e.vel.y = (dy / dd) * spd;
    e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt;
    e.facing = dx > 0 ? 1 : -1;
    resolveObstacles(e.pos, e.radius, state);
    wrapPos(state, e.pos);
    d.atkCd = Math.max(0, ((d.atkCd as number) ?? 0) - dt);
    return;
  }

  // Re-evaluate the nearest enemy every 0.5s.
  d.retargetT = ((d.retargetT as number) ?? 0) - dt;
  let target = allyTargetValid(state, d.targetId as number | undefined);
  if ((d.retargetT as number) <= 0 || !target) {
    d.retargetT = ALLY_RETARGET_SECONDS;
    let best: Entity | undefined;
    let bestD = 900 * 900;
    for (const en of state.entities.values()) {
      if (en.team !== "enemy" || en.hp <= 0) continue;
      if (en.kind === "ramses" && (en.data?.seated || en.data?.downedUntil != null)) continue;
      const d2 = wrapDist2(state, en.pos, e.pos);
      if (d2 < bestD) { bestD = d2; best = en; }
    }
    target = best;
    d.targetId = best?.id;
  }

  d.atkCd = ((d.atkCd as number) ?? 0) - dt;
  if (target) {
    const dx = wrapDelta(target.pos.x, e.pos.x, state.worldW);
    const dy = wrapDelta(target.pos.y, e.pos.y, state.worldH);
    const dd = Math.hypot(dx, dy) || 1;
    e.facing = dx > 0 ? 1 : -1;
    const reach = def.range + target.radius;
    if (dd <= reach) {
      if ((d.atkCd as number) <= 0) {
        d.attackT = def.windup + def.action;
        d.attackTMax = def.windup + def.action;
        d.attackWindup = def.windup;
        d.attackSwing = def.action;
        d.attackResolved = false;
        d.attackDir = { x: dx / dd, y: dy / dd };
        d.attackTarget = { x: e.pos.x + dx, y: e.pos.y + dy };
        d.attackNearestId = target.id;
        d.atkCd = def.cooldown;
        d.fxSeed = Math.floor(Math.random() * 100000);
      }
      // Keep a little distance for ranged champions instead of hugging foes.
    } else {
      e.vel.x = (dx / dd) * def.moveSpeed; e.vel.y = (dy / dd) * def.moveSpeed;
      e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt;
    }
  }
  resolveObstacles(e.pos, e.radius, state);
  wrapPos(state, e.pos);
}

function allyHitEnemy(state: GameState, en: Entity, dmg: number) {
    en.hp -= dmg;
  spawnVisualHazard(state, "hitspark", { x: en.pos.x, y: en.pos.y - 14 }, 0.18, { seed: Math.floor(Math.random() * 99999), small: 1 });
  if (en.hp <= 0) killEnemy(state, en);
}

function staffStrikeDamage(state: GameState): number {
  return PLAGUES.staff.scale(state.plagues.get("staff") ?? 1).dmg * damageMultiplier(state);
}

function resolveAllyAttack(state: GameState, ally: Entity, def: AllyDef) {
  const d = ally.data!;
  const dir = (d.attackDir as Vec2) ?? { x: ally.facing, y: 0 };
  const dmg = def.damage * damageMultiplier(state) * 3;
  const seed = (d.fxSeed as number) ?? 1;
  if (def.attack === "broom") {
    // The broom head is the hit: its reach at full swing defines the contact
    // point, never the champion's own body.
    const c = { x: ally.pos.x + dir.x * def.range, y: ally.pos.y + dir.y * def.range };
    for (const en of [...state.entities.values()]) {
      if (en.team !== "enemy" || en.hp <= 0) continue;
      if (en.kind === "ramses" && (en.data?.seated || en.data?.downedUntil != null)) continue;
      if (wrapDist2(state, en.pos, c) < (def.hitRadius + en.radius) ** 2) allyHitEnemy(state, en, def.staffDamage ? staffStrikeDamage(state) : dmg);
    }
    spawnVisualHazard(state, "allydust", c, 0.5, { seed, radius: def.hitRadius });
  } else if (def.attack === "water") {
    // Water leaves the basket and travels to the target as a real projectile.
    const spd = 300;
    // Spawn exactly at the basket in the sprite (scaled, mirrored by facing);
    // `lift` is the basket's height above the ground point for the renderer.
    const sc = def.sprite.scale ?? 1;
    const origin = { x: ally.pos.x + (def.sprite.FX.x - def.sprite.CX) * sc * ally.facing, y: ally.pos.y };
    const lift0 = (def.sprite.H - def.sprite.FX.y) * sc - 10;
    const w: Entity = {
      id: state.nextId++,
      pos: origin,
      vel: { x: dir.x * spd, y: dir.y * spd },
      radius: 9,
      hp: 1, maxHp: 1,
      team: "projectile", facing: ally.facing,
      animT: 0, born: state.now,
      ttl: 1.2, dmg,
      kind: "bolt",
      data: { hit: new Set<number>(), boltKind: "allywater", lift0, seed, angle: Math.atan2(dir.y, dir.x), splashR: def.hitRadius },
    };
    state.entities.set(w.id, w);
  } else if (def.attack === "horn") {
    // Sound waves expand forward from the horn in a cone.
    const R = def.hitRadius;
    for (const en of [...state.entities.values()]) {
      if (en.team !== "enemy") continue;
      if (en.kind === "ramses" && (en.data?.seated || en.data?.downedUntil != null)) continue;
      const dx = wrapDelta(en.pos.x, ally.pos.x, state.worldW);
      const dy = wrapDelta(en.pos.y, ally.pos.y, state.worldH);
      const dd = Math.hypot(dx, dy);
      if (dd > R + en.radius) continue;
      if (dd > 1 && (dx * dir.x + dy * dir.y) / dd < 0.45) continue;
      allyHitEnemy(state, en, dmg);
      // Short, smooth push away from the horn; Ramses and a committed agile
      // dash are not displaced.
      if (en.kind !== "ramses" && !(en.kind === "agilesoldier" && en.data?.specialDash)) {
        en.data ??= {};
        const k = dd > 1 ? dd : 1;
        en.data.knockVx = (dd > 1 ? dx / k : dir.x) * 260;
        en.data.knockVy = (dd > 1 ? dy / k : dir.y) * 260;
        en.data.knockUntil = state.now + 0.22;
      }
    }
    spawnVisualHazard(state, "allyhorn", { x: ally.pos.x, y: ally.pos.y }, 0.6, {
      seed, radius: R, angle: Math.atan2(dir.y, dir.x), allyId: ally.id,
    });
  }
}

function downCompanion(state: GameState, n: Entity) {
  if (n.data?.downedUntil) return;
  n.hp = 0;
  if (!n.data) n.data = {};
  n.data.downedUntil = state.now + ALLY_REVIVE_SECONDS;
  delete n.data.attackT;
}

// ---------- leveling ----------
function levelUp(state: GameState) {
  state.xp -= state.xpToNext;
  state.level++;
  state.xpToNext = Math.floor(5 + state.level * 3 + state.level ** 1.35);
  state.player.maxHp += 5;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 15);
  restoreShield(state, SHIELD_CONFIG.levelUpRestore);
  offerUpgrades(state);
}

/** Shared champion damage: real HP loss, hit feedback, and the death/grave path. */
function damageAlly(state: GameState, n: Entity, dmg: number, fxAt?: Vec2) {
  if (n.data?.downedUntil) return;
  n.hp -= dmg;
  if (fxAt) spawnVisualHazard(state, "hitspark", fxAt, 0.18, { seed: n.id, small: 1 });
  if (n.hp <= 0) downCompanion(state, n);
}

function summonCompanion(state: GameState, npcId: import("./types").NpcId) {
  const def = allyDef(npcId);
  if (!def || state.npcs.has(npcId)) return;
  const vw = state.viewport?.w ?? 800;
  const vh = state.viewport?.h ?? 600;
  const m = 80;
  const px = state.camera.x + rand(-vw / 2 + m, vw / 2 - m);
  const py = state.camera.y + rand(-vh / 2 + m, vh / 2 - m);
  const ally: Entity = {
    id: state.nextId++,
    pos: { x: px, y: py },
    vel: { x: 0, y: 0 },
    radius: 12,
    hp: def.maxHp, maxHp: def.maxHp,
    team: "ally", facing: 1,
    animT: 0, born: state.now,
    kind: npcId,
    data: { atkCd: 1.0, summonUntil: state.now + 1.0 },
  };
  state.entities.set(ally.id, ally);
  state.npcs.set(npcId, ally.id);
  state.newNpcs.add(npcId);
  // One-shot invocation blast: clears ordinary enemies around the arrival point.
  for (const en of [...state.entities.values()]) {
    if (en.team !== "enemy" || en.kind === "ramses") continue;
    if (wrapDist2(state, en.pos, ally.pos) < def.invokeRadius * def.invokeRadius) {
      en.hp = 0;
      killEnemy(state, en);
    }
  }
  spawnVisualHazard(state, "allyinvoke", ally.pos, 0.8, { seed: Math.floor(Math.random() * 99999), radius: def.invokeRadius });
  pushNotification(state, `+ ${def.name}`, "#ffd070");
}

function offerUpgrades(state: GameState) {
  const choices: UpgradeChoice[] = [];
  const active = state.plagues;

  // Plague level-ups.
  for (const [id, lvl] of active) {
    const def = PLAGUES[id];
    choices.push({
      id: `${id}-up-${lvl + 1}`,
      plague: id,
      title: `${def.name} — Rank ${lvl + 1}`,
      description: def.description,
      apply: (s) => s.plagues.set(id, (s.plagues.get(id) ?? 1) + 1),
    });
  }

  // Plague unlock (only next in biblical order).
  for (const id of PLAGUE_ORDER) {
    if (active.has(id)) continue;
    const def = PLAGUES[id];
    if (state.level < def.unlockLevel) break;
    choices.push({
      id: `${id}-unlock`,
      plague: id,
      title: `Unlock: ${def.name}`,
      description: def.description,
      scripture: def.scripture,
      isUnlock: true,
      apply: (s) => {
        s.plagues.set(id, 1);
        s.plagueCooldown.set(id, 0.5);
        s.newPlagues.add(id);
        pushNotification(s, `Unlocked: ${def.name}`, "#c4a24a");
      },
    });
    break;
  }

  // Passive upgrades.
  for (const pid of PASSIVE_ORDER) {
    const def = PASSIVES[pid];
    if (passiveRank(state, pid) >= def.maxRank) continue;
    choices.push({
      id: `passive-${pid}-${state.level}`,
      title: def.title,
      description: def.description,
      apply: (s) => def.apply(s),
    });
  }

  // Champion — offered on every 5th level, picked at random from the pool of
  // champions not yet recruited.
  let companion: UpgradeChoice | null = null;
  if (state.level % 5 === 0) {
    const available = ALLY_POOL.filter((id) => !state.npcs.has(id));
    if (available.length) {
      const npcId = available[Math.floor(Math.random() * available.length)];
      const def = allyDef(npcId)!;
      companion = {
        id: `npc-${npcId}-${state.level}`,
        npc: npcId,
        isCompanion: true,
        isUnlock: true,
        title: `Champion: ${def.name}`,
        description: def.description,
        scripture: def.scripture,
        apply: (s) => summonCompanion(s, npcId),
      };
    }
  }

  // Shuffle non-companion choices; cap to 3 (or 2+companion when eligible).
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  const picks = choices.slice(0, companion ? 2 : 3);
  if (companion) picks.push(companion);
  if (picks.length === 0) return;
  state.levelUpPending = picks;
}

export function applyUpgrade(state: GameState, choice: UpgradeChoice) {
  choice.apply(state);
  state.levelUpPending = null;
}

export function dismissNewPlague(state: GameState, id: PlagueId) {
  state.newPlagues.delete(id);
}

export function dismissNewNpc(state: GameState, id: import("./types").NpcId) {
  state.newNpcs.delete(id);
}

// Re-export for callers who might need enemy defs (unused today, keeps tree-shake happy).
export { ENEMY_DEFS };
