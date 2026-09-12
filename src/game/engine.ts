import type { Entity, GameState, PlagueId, UpgradeChoice, Vec2 } from "./types";
import { PLAGUES, PLAGUE_ORDER } from "./plagues";
import { NPC_ORDER, NPCS } from "./npcs";
import { BONUSES, rollBonusKind, shieldDamageMul, pushNotification, type BonusKind } from "./bonuses";
import { PASSIVES, PASSIVE_ORDER, damageMultiplier, magnetMultiplier, passiveRank, speedMultiplier } from "./passives";
import { ENEMY_DEFS, enemyTick, makeEnemy, pickEnemyKind } from "./enemies";
import { spawnRamses, tickRamses } from "./ramses";
import { MOSES_ART, MOSES_ATTACK, mosesSwingAngle } from "./mosesGameArt";
import { SOLDIER_PUNCH_DUR } from "./soldierArt";
import { DOG_POUNCE_DUR } from "./dogArt";
import { ARCHER_SHOOT_DUR } from "./archerArt";
import { AXE_SWING_DUR } from "./axeSoldierArt";
import { HEAVY_SWING_DUR } from "./heavySoldierArt";
import { playShieldBlock } from "./sfx";


// Basic melee enemies attack from just beside Moses instead of overlapping him.
// `gap` = extra distance beyond the two sprite radii, `from`/`to` = the slice of
// the attack animation during which the blow actually connects.
const MELEE_ATTACKS: Record<string, { key: string; dur: number; gap: number; from: number; to: number }> = {
  soldier: { key: "punchAt", dur: SOLDIER_PUNCH_DUR, gap: 34, from: 0.4, to: 0.62 },
  jackal: { key: "pounceAt", dur: DOG_POUNCE_DUR, gap: 30, from: 0.45, to: 0.75 },
  axesoldier: { key: "axeAt", dur: AXE_SWING_DUR, gap: 34, from: 0.42, to: 0.6 },
  heavysoldier: { key: "heavyAt", dur: HEAVY_SWING_DUR, gap: 36, from: 0.45, to: 0.62 },
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
export function createInitialState(): GameState {
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
  };
  state.entities.set(player.id, player);
  const DECOR_RADIUS: Record<string, number> = { palm: 12, rock: 16, pyramid: 44 };
  const obstacles: Array<{ pos: Vec2; r: number }> = [];
  for (let i = 0; i < 60; i++) {
    const k = Math.random();
    const kind = k < 0.6 ? "palm" : k < 0.9 ? "rock" : "pyramid";
    let px = 0, py = 0;
    for (let tries = 0; tries < 8; tries++) {
      px = rand(0, worldW);
      py = rand(0, worldH);
      if (Math.hypot(px - player.pos.x, py - player.pos.y) > 220) break;
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
  // Throne decor + Ramses himself. Throne is placed slightly further away
  // so Ramses (spawned in ramses.ts at +180) renders in front of it.
  const thronePos = { x: player.pos.x + 180, y: player.pos.y - 60 };
  const throne: Entity = {
    id: state.nextId++,
    pos: thronePos,
    vel: { x: 0, y: 0 },
    radius: 0,
    hp: 1, maxHp: 1,
    team: "decor", facing: 1, animT: 0, born: 0,
    kind: "throne",
    data: {},
  };
  state.entities.set(throne.id, throne);
  // Throne is a solid obstacle everyone must go around.
  obstacles.push({ pos: thronePos, r: 40 });
  state.obstacles = obstacles;
  spawnRamses(state);
  return state;
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
      state.plagueCooldown.set(id, def.scale(level).cooldown);
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

      // Ramses handled separately.
      if (e.kind === "ramses") {
        // still take contact damage handled in tickRamses; skip here.
        continue;
      }
      // pick nearest target (Moses or ally) using wrapped delta
      let targetPos: Vec2 = { x: e.pos.x + wrapDelta(p.pos.x, e.pos.x, state.worldW), y: e.pos.y + wrapDelta(p.pos.y, e.pos.y, state.worldH) };
      let bestD = wrapDist2(state, e.pos, p.pos);
      for (const npcId of state.npcs.values()) {
        const n = state.entities.get(npcId);
        if (!n || n.data?.downedUntil) continue;
        if (n.data?.summonUntil && state.now < (n.data.summonUntil as number)) continue;
        const d = wrapDist2(state, e.pos, n.pos);
        if (d < bestD * 0.7) {
          bestD = d;
          targetPos = { x: e.pos.x + wrapDelta(n.pos.x, e.pos.x, state.worldW), y: e.pos.y + wrapDelta(n.pos.y, e.pos.y, state.worldH) };
        }
      }
      enemyTick(state, e, targetPos, dt, {
        baseSlow: enemySlow,
        resolveObstacles: (pos, r) => resolveObstacles(pos, r, state),
        spawnEnemyProjectile: (owner, dir, kind, spd, dmg, ttl) => spawnEnemyProjectile(state, owner, dir, kind, spd, dmg, ttl),
      });
      wrapPos(state, e.pos);

      // ---- melee attack: triggered from beside Moses, damage lands mid-anim ----
      const melee = MELEE_ATTACKS[e.kind];
      const dd = Math.sqrt(wrapDist2(state, e.pos, p.pos));
      if (melee) {
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
            p.hp -= contactDmg * dt * shieldDamageMul(state);
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
            }

            if (p.hp <= 0) { state.gameOver = true; state.running = false; }
          }
        }
      } else if (!invuln && dd < e.radius + p.radius) {
        // Contact damage (non-melee kinds keep the original overlap behaviour).
        const contactDmg = (e.data?.contactDmg as number) ?? 8;
        p.hp -= contactDmg * dt * shieldDamageMul(state);
        state.damageImpactKind = e.kind === "ramses" ? "ramses" : "normal";
        if (p.hp <= 0) { state.gameOver = true; state.running = false; }
      }

      for (const npcId of state.npcs.values()) {
        const n = state.entities.get(npcId);
        if (!n || n.data?.downedUntil) continue;
        if (n.data?.summonUntil && state.now < (n.data.summonUntil as number)) continue;
        if (wrapDist2(state, e.pos, n.pos) < (e.radius + n.radius) ** 2) {
          const contactDmg = (e.data?.contactDmg as number) ?? 8;
          n.hp -= contactDmg * dt;
          if (n.hp <= 0) downCompanion(state, n);
        }
      }

    } else if (e.team === "ally") {
      updateCompanion(state, e, dt);
    } else if (e.team === "projectile") {
      e.ttl = (e.ttl ?? 0) - dt;
      if (e.ttl <= 0) {
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
        state.entities.delete(e.id);
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

      // Enemy-owned projectile hits player: tested against Moses' whole visible
      // body (feet → head), not just his centre point, and swept over the frame
      // so a fast arrow can never tunnel straight through him.
      if (e.data?.enemyOwned) {
        const hitPt = playerBodyHit(state, e, dt);
        if (!invuln && hitPt) {
          p.hp -= (e.dmg ?? 5) * shieldDamageMul(state);
          const owner = e.ownerId == null ? undefined : state.entities.get(e.ownerId);
          state.damageImpactKind = owner?.kind === "ramses" ? "ramses" : "normal";
          // Small impact + blood exactly where the projectile struck Moses.
          spawnVisualHazard(state, "hitspark", hitPt, 0.18, { seed: e.id, small: 1 });
          spawnVisualHazard(state, "bloodhit", hitPt, 0.45, { seed: e.id, maxTtl: 0.45 });
          state.entities.delete(e.id);
          if (p.hp <= 0) { state.gameOver = true; state.running = false; }
        }
        if (!state.entities.has(e.id)) continue;
        continue;
      }


      if (e.kind === "hailstone" || e.kind === "fireball") continue;
      const hit = e.data?.hit as Set<number> | undefined;
      for (const en of state.entities.values()) {
        if (en.team !== "enemy") continue;
        if (hit?.has(en.id)) continue;
        if (dist2(en.pos, e.pos) < (en.radius + e.radius) ** 2) {
          en.hp -= e.dmg ?? 0;
          if (hit) hit.add(en.id);
          if (!e.data?.pierce) { state.entities.delete(e.id); break; }
          if (en.hp <= 0) killEnemy(state, en);
        }
      }
    } else if (e.team === "hazard") {
      e.ttl = (e.ttl ?? 0) - dt;
      if (e.ttl <= 0) { state.entities.delete(e.id); continue; }
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
  const HALF_CONE = 0.85; // ~49 degrees each side of the facing direction
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
    let inRange = dd < en.radius + tolerance;
    if (!inRange) {
      // Cone test, measured from Moses' hand toward his facing direction.
      const ex = (en.pos.x - cx) * facing; // forward component (always >0 in front)
      const ey = en.pos.y - cy;
      const dist = Math.hypot(ex, ey);
      if (ex > 0 && dist < reach + en.radius) {
        inRange = Math.abs(Math.atan2(ey, ex)) <= HALF_CONE;
      }
    }
    if (inRange) candidates.push({ en, px, py });
  }

  // A shield soldier in the swing's path stops it dead: metallic clang, sparks,
  // zero damage anywhere.
  const shielded = candidates.find((c) => c.en.kind === "shieldsoldier");
  if (shielded) {
    d.blocked = true;
    shielded.en.data ??= {};
    shielded.en.data.blockAt = state.now;
    const sx = shielded.en.pos.x + (state.player.pos.x - shielded.en.pos.x) * 0.42;
    const sy = shielded.en.pos.y - shielded.en.radius * 1.6;
    spawnVisualHazard(state, "shieldclang", { x: sx, y: sy }, 0.24, {
      seed: Math.floor(Math.random() * 1000),
      maxTtl: 0.24,
    });
    playShieldBlock();
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
    // knockback
    const kx = en.pos.x - state.player.pos.x;
    const ky = en.pos.y - state.player.pos.y;
    const kd = Math.hypot(kx, ky) || 1;
    en.pos.x += (kx / kd) * 10;
    en.pos.y += (ky / kd) * 10;
    if (en.hp <= 0) killEnemy(state, en);
  }
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
  const HALF_CONE = 0.85;
  for (const en of state.entities.values()) {
    if (en.team !== "enemy") continue;
    const ex = (en.pos.x - cx) * facing;
    const ey = en.pos.y - cy;
    if (ex <= 0) continue;
    if (Math.hypot(ex, ey) > reach + en.radius) continue;
    if (Math.abs(Math.atan2(ey, ex)) <= HALF_CONE) return true;
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
    const angle = Math.random() * Math.PI * 2;
    const r = 480 + Math.random() * 120;
    const p = state.player.pos;
    const kind = pickEnemyKind(state);
    const e = makeEnemy(state, kind, {
      x: p.x + Math.cos(angle) * r,
      y: p.y + Math.sin(angle) * r,
    });
    state.entities.set(e.id, e);
  }
}

/**
 * Moses' body box (feet → head) tested against a projectile's path this frame.
 * Returns the contact point, or null when nothing touched him.
 */
function playerBodyHit(state: GameState, e: Entity, dt: number): Vec2 | null {
  const p = state.player;
  const halfW = 13 + (e.radius ?? 4) * 0.5;
  const top = p.pos.y - 58;
  const bottom = p.pos.y + 8;
  const prevX = e.pos.x - e.vel.x * dt;
  const prevY = e.pos.y - e.vel.y * dt;
  const steps = 4;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const x = prevX + (e.pos.x - prevX) * t;
    const y = prevY + (e.pos.y - prevY) * t;
    if (Math.abs(x - p.pos.x) <= halfW && y >= top && y <= bottom) return { x, y };
  }
  return null;
}

function spawnEnemyProjectile(state: GameState, owner: Entity, dir: Vec2, kind: string, speed: number, dmg: number, ttl: number) {

  const e: Entity = {
    id: state.nextId++,
    pos: { x: owner.pos.x, y: owner.pos.y },
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
}

function castPlague(state: GameState, id: PlagueId, level: number) {
  const def = PLAGUES[id];
  const stats = def.scale(level);
  const dmul = damageMultiplier(state);
  const p = state.player.pos;

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
        ttl: stats.ttl, dmg: stats.dmg * dmul,
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
  if (e.kind === "ramses") { e.hp = 1; return; }
  state.entities.delete(e.id);
  state.kills++;
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


// ---------- companion definitions & AI ----------
type CompanionCombat = {
  attackRange: number;
  cooldown: number;
  boltSpeed: number;
  boltDmg: number;
  boltRadius: number;
  boltColor: string;
  boltKind: string;
};
const COMPANION_COMBAT: Record<import("./types").NpcId, CompanionCombat> = {
  bithiah:  { attackRange: 200, cooldown: 1.4, boltSpeed: 260, boltDmg: 10, boltRadius: 5, boltColor: "#f0e8b4", boltKind: "reed" },
  aaron:    { attackRange: 90,  cooldown: 0.9, boltSpeed: 0,   boltDmg: 22, boltRadius: 6, boltColor: "#c48a3a", boltKind: "aaronstaff" },
  miriam:   { attackRange: 210, cooldown: 1.3, boltSpeed: 240, boltDmg: 14, boltRadius: 7, boltColor: "#7fc7ff", boltKind: "waterbowl" },
  jethro:   { attackRange: 170, cooldown: 1.8, boltSpeed: 200, boltDmg: 20, boltRadius: 6, boltColor: "#e8c060", boltKind: "wisdom" },
  zipporah: { attackRange: 220, cooldown: 1.1, boltSpeed: 300, boltDmg: 14, boltRadius: 4, boltColor: "#b0b0b0", boltKind: "flint" },
  joshua:   { attackRange: 260, cooldown: 1.0, boltSpeed: 340, boltDmg: 20, boltRadius: 4, boltColor: "#d8d4c0", boltKind: "spear" },
  hur:      { attackRange: 180, cooldown: 1.6, boltSpeed: 260, boltDmg: 16, boltRadius: 5, boltColor: "#f0a0f0", boltKind: "prayer" },
  elder:    { attackRange: 200, cooldown: 1.4, boltSpeed: 260, boltDmg: 18, boltRadius: 5, boltColor: "#e0e0ff", boltKind: "prayer" },
};

function updateCompanion(state: GameState, e: Entity, dt: number) {
  const d = e.data!;
  // Summon lockout — companion is invulnerable and frozen for ~1s while the
  // golden summoning light plays around them.
  if (d.summonUntil && state.now < (d.summonUntil as number)) {
    return;
  }
  if (d.downedUntil) {
    if (state.now >= (d.downedUntil as number)) {
      d.downedUntil = undefined;
      d.standupUntil = state.now + 0.6; // brief rise animation
      e.hp = e.maxHp;
    } else {
      return;
    }
  }
  if (d.standupUntil && state.now < (d.standupUntil as number)) {
    // Rising — no movement or attack until standup completes.
    return;
  } else if (d.standupUntil) {
    d.standupUntil = undefined;
  }
  const p = state.player;
  const combat = COMPANION_COMBAT[e.kind as import("./types").NpcId] ?? COMPANION_COMBAT.elder;
  const inView = inViewport(state, e.pos);

  if (!inView) {
    const dx = p.pos.x - e.pos.x;
    const dy = p.pos.y - e.pos.y;
    const dd = Math.hypot(dx, dy) || 1;
    const spd = 160;
    e.pos.x += (dx / dd) * spd * dt;
    e.pos.y += (dy / dd) * spd * dt;
    e.facing = dx > 0 ? 1 : -1;
    d.wanderT = 0;
  } else {
    let wt = ((d.wanderT as number) ?? 0) - dt;
    let wx = (d.wanderX as number) ?? e.pos.x;
    let wy = (d.wanderY as number) ?? e.pos.y;
    if (wt <= 0 || Math.hypot(wx - e.pos.x, wy - e.pos.y) < 6) {
      const vw = state.viewport?.w ?? 800;
      const vh = state.viewport?.h ?? 600;
      const m = 60;
      wx = state.camera.x + rand(-vw / 2 + m, vw / 2 - m);
      wy = state.camera.y + rand(-vh / 2 + m, vh / 2 - m);
      wt = 2 + Math.random() * 2.5;
      d.wanderX = wx; d.wanderY = wy;
    }
    d.wanderT = wt;
    const dx = wx - e.pos.x;
    const dy = wy - e.pos.y;
    const dd = Math.hypot(dx, dy) || 1;
    const spd = 70;
    e.pos.x += (dx / dd) * spd * dt;
    e.pos.y += (dy / dd) * spd * dt;
    if (Math.abs(dx) > 2) e.facing = dx > 0 ? 1 : -1;
  }
  resolveObstacles(e.pos, e.radius, state);
  wrapPos(state, e.pos);

  // attack animation timer (visualized by renderer)
  if ((d.attackT as number | undefined) != null) {
    d.attackT = Math.max(0, (d.attackT as number) - dt);
    if ((d.attackT as number) <= 0) delete d.attackT;
  }

  const cd = ((d.atkCd as number) ?? 0) - dt;
  if (cd <= 0) {
    let nearest: Entity | null = null;
    let bestD = combat.attackRange * combat.attackRange;
    for (const en of state.entities.values()) {
      if (en.team !== "enemy") continue;
      const d2 = wrapDist2(state, en.pos, e.pos);
      if (d2 < bestD) { bestD = d2; nearest = en; }
    }
    if (nearest) {
      // Windup pose plays first; the projectile / hit resolves after windup.
      const windup = 0.18;
      const swing = 0.22;
      d.attackT = windup + swing;
      d.attackTMax = windup + swing;
      d.attackWindup = windup;
      d.attackSwing = swing;
      d.attackTarget = { x: nearest.pos.x, y: nearest.pos.y };
      d.attackNearestId = nearest.id;
      d.attackResolved = false;
      d.atkCd = combat.cooldown;
    } else {
      d.atkCd = 0.3;
    }
  } else {
    d.atkCd = cd;
  }

  // Resolve the attack the moment the swing peaks (mid-arc), so animation and
  // damage/projectile spawning are synchronised.
  if ((d.attackT as number | undefined) != null && !d.attackResolved) {
    const total = (d.attackTMax as number) ?? 0.4;
    const windup = (d.attackWindup as number) ?? 0.18;
    if ((d.attackT as number) <= total - windup) {
      const tid = d.attackNearestId as number | undefined;
      const tgt = tid != null ? state.entities.get(tid) : undefined;
      const fallback = tgt && tgt.hp > 0
        ? tgt
        : ({ pos: (d.attackTarget as { x: number; y: number }) ?? e.pos, hp: 1 } as unknown as Entity);
      spawnCompanionAttack(state, e, fallback, combat);
      d.attackResolved = true;
    }
  }
}

function spawnCompanionAttack(state: GameState, ally: Entity, target: Entity, combat: CompanionCombat) {
  const dx = target.pos.x - ally.pos.x;
  const dy = target.pos.y - ally.pos.y;
  const dd = Math.hypot(dx, dy) || 1;
  ally.facing = dx > 0 ? 1 : -1;
  const dmul = damageMultiplier(state) * 3; // companions hit ×3 harder
  if (combat.boltSpeed === 0) {
    if (dd < combat.attackRange) {
      target.hp -= combat.boltDmg * dmul;
      if (target.hp <= 0) killEnemy(state, target);
    }
    spawnVisualHazard(state, "companionmelee", { x: ally.pos.x + (dx / dd) * 20, y: ally.pos.y + (dy / dd) * 20 }, 0.18, { color: combat.boltColor });
    return;
  }
  const e: Entity = {
    id: state.nextId++,
    pos: { x: ally.pos.x, y: ally.pos.y },
    vel: { x: (dx / dd) * combat.boltSpeed, y: (dy / dd) * combat.boltSpeed },
    radius: combat.boltRadius,
    hp: 1, maxHp: 1,
    team: "projectile", facing: ally.facing,
    animT: 0, born: state.now,
    ttl: 1.4, dmg: combat.boltDmg * dmul,
    kind: "bolt",
    data: { hit: new Set<number>(), boltKind: combat.boltKind, boltColor: combat.boltColor, angle: Math.atan2(dy, dx) },
  };
  state.entities.set(e.id, e);
}

function downCompanion(state: GameState, n: Entity) {
  n.hp = 0;
  if (!n.data) n.data = {};
  n.data.downedUntil = state.now + 15;
}

// ---------- leveling ----------
function levelUp(state: GameState) {
  state.xp -= state.xpToNext;
  state.level++;
  state.xpToNext = Math.floor(5 + state.level * 3 + state.level ** 1.35);
  state.player.maxHp += 5;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 15);
  offerUpgrades(state);
}

function summonCompanion(state: GameState, npcId: import("./types").NpcId) {
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
    hp: 2700, maxHp: 2700, // companions are much sturdier (×15)
    team: "ally", facing: 1,
    animT: 0, born: state.now,
    kind: npcId,
    data: { atkCd: 1.2, wanderT: 0, summonUntil: state.now + 1.0 },
  };
  state.entities.set(ally.id, ally);
  state.npcs.set(npcId, ally.id);
  state.nextNpcIndex = Math.min(NPC_ORDER.length, state.nextNpcIndex + 1);
  state.newNpcs.add(npcId);
  pushNotification(state, `+ ${NPCS[npcId].name}`, "#ffd070");
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

  // Companion — only when nextCompanionLevel reached.
  const gate = state.nextCompanionLevel ?? 5;
  const companionEligible = state.level >= gate;
  let companion: UpgradeChoice | null = null;
  if (companionEligible) {
    const idx = state.nextNpcIndex;
    const npcId: import("./types").NpcId = idx < NPC_ORDER.length ? NPC_ORDER[idx] : "elder";
    const npc = NPCS[npcId];
    const isFirst = !state.npcs.has(npcId);
    companion = {
      id: `npc-${npcId}-${state.level}`,
      npc: npcId,
      isCompanion: true,
      isUnlock: isFirst,
      title: isFirst ? `Companion: ${npc.name}` : `${npc.name} joins again`,
      description: npc.description,
      scripture: npc.scripture,
      apply: (s) => {
        summonCompanion(s, npcId);
        s.nextCompanionLevel = s.level + 5 + Math.floor(Math.random() * 3);
      },
    };
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
