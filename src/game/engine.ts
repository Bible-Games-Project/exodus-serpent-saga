import type { Entity, GameState, PlagueId, UpgradeChoice, Vec2 } from "./types";
import { PLAGUES, PLAGUE_ORDER } from "./plagues";
import { NPC_ORDER, NPCS } from "./npcs";

// ---------- utilities ----------
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------- state factory ----------
export function createInitialState(): GameState {
  const worldW = 4000;
  const worldH = 4000;
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
    // Moses starts with the shepherd's staff (Exodus 4). The staff-into-
    // serpent sign unlocks later as an upgrade choice.
    plagues: new Map([["staff" as PlagueId, 1]]),
    plagueCooldown: new Map([["staff" as PlagueId, 0.3]]),
    npcs: new Map(),
    nextNpcIndex: 0,
    newPlagues: new Set<PlagueId>(),
    newNpcs: new Set(),
    input: { x: 0, y: 0 },
    worldW,
    worldH,
  };
  state.entities.set(player.id, player);
  // Sprinkle some decor
  for (let i = 0; i < 60; i++) {
    const k = Math.random();
    const kind = k < 0.6 ? "palm" : k < 0.9 ? "rock" : "pyramid";
    const dec: Entity = {
      id: state.nextId++,
      pos: { x: rand(0, worldW), y: rand(0, worldH) },
      vel: { x: 0, y: 0 },
      radius: 0,
      hp: 1,
      maxHp: 1,
      team: "decor",
      facing: 1,
      animT: 0,
      born: 0,
      kind,
    };
    state.entities.set(dec.id, dec);
  }
  return state;
}

// ---------- pixel-art blood pool builder ----------
// Generates an irregular, hand-plotted pixel blob so no two pools look alike.
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
  // Build irregular shape from several overlapping offset "blobs".
  const blobs: Array<[number, number, number]> = [];
  const nBlobs = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < nBlobs; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.55;
    const rr = radius * 0.32 + Math.random() * radius * 0.4;
    blobs.push([Math.cos(a) * r, Math.sin(a) * r, rr]);
  }
  const isInside = (px: number, py: number): number => {
    // returns -1 outside, or the smallest signed distance from edge (0 = right on edge)
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
        // inside the pool
        let color = "#8a1010";
        if (edge < 3) {
          color = shade < 0.55 ? "#4c0606" : "#a02222";
        } else if (edge < 6) {
          color = shade < 0.4 ? "#6a0c0c" : "#a02222";
        } else if (shade < 0.14) {
          color = "#c02828";
        } else if (shade < 0.35) {
          color = "#6a0c0c";
        }
        g.fillStyle = color;
        g.fillRect(x, y, pixel, pixel);
      } else if (edge > -5 && Math.random() < 0.35) {
        // splatter droplet near the edge
        g.fillStyle = shade < 0.5 ? "#4c0606" : "#8a1010";
        g.fillRect(x, y, pixel, pixel);
      } else if (edge > -10 && Math.random() < 0.06) {
        // outlying speck
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

  // Player movement
  const p = state.player;
  const speed = 150;
  const ix = state.input.x;
  const iy = state.input.y;
  const mag = Math.hypot(ix, iy) || 1;
  p.vel.x = (ix / mag) * speed * (Math.hypot(ix, iy) > 0.05 ? 1 : 0);
  p.vel.y = (iy / mag) * speed * (Math.hypot(ix, iy) > 0.05 ? 1 : 0);
  p.pos.x = clamp(p.pos.x + p.vel.x * dt, 30, state.worldW - 30);
  p.pos.y = clamp(p.pos.y + p.vel.y * dt, 30, state.worldH - 30);
  if (Math.abs(p.vel.x) > 5) p.facing = p.vel.x > 0 ? 1 : -1;
  p.animT += dt * (Math.hypot(p.vel.x, p.vel.y) > 5 ? 6 : 0);

  // Camera follows
  state.camera.x += (p.pos.x - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (p.pos.y - state.camera.y) * Math.min(1, dt * 5);

  // Spawn enemies over time (difficulty ramps with survival minutes)
  const minutes = state.now / 60;
  const spawnRate = 0.9 + minutes * 0.6; // per second
  spawnEnemies(state, dt, spawnRate);

  // Keep the orbiting fly swarm in sync with the "flies" plague level.
  syncOrbitFlies(state, dt);

  // Cast plagues
  for (const [id, level] of state.plagues) {
    const cd = (state.plagueCooldown.get(id) ?? 0) - dt;
    if (cd <= 0) {
      castPlague(state, id, level);
      const def = PLAGUES[id];
      state.plagueCooldown.set(id, def.scale(level).cooldown);
    } else {
      state.plagueCooldown.set(id, cd);
    }
  }

  // Move entities
  for (const e of state.entities.values()) {
    if (e === p) continue;
    e.animT += dt * 6;

    if (e.team === "enemy") {
      // Chase player (or nearest ally if closer and blocking)
      let targetPos = p.pos;
      let bestD = dist2(e.pos, p.pos);
      for (const npcId of state.npcs.values()) {
        const n = state.entities.get(npcId);
        if (!n) continue;
        const d = dist2(e.pos, n.pos);
        if (d < bestD * 0.7) {
          bestD = d;
          targetPos = n.pos;
        }
      }
      const dx = targetPos.x - e.pos.x;
      const dy = targetPos.y - e.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      const spd = (e.data?.speed as number) ?? 60;
      e.pos.x += (dx / d) * spd * dt;
      e.pos.y += (dy / d) * spd * dt;
      e.facing = dx > 0 ? 1 : -1;

      // Damage player on contact
      if (dist2(e.pos, p.pos) < (e.radius + p.radius) ** 2) {
        const contactDmg = (e.data?.contactDmg as number) ?? 8;
        p.hp -= contactDmg * dt;
        if (p.hp <= 0) {
          state.gameOver = true;
          state.running = false;
        }
      }
    } else if (e.team === "ally") {
      // Follow player at loose distance, attack nearest enemy in range
      const dx = p.pos.x - e.pos.x;
      const dy = p.pos.y - e.pos.y;
      const d = Math.hypot(dx, dy);
      const followDist = 80 + (e.data?.slot as number ?? 0) * 15;
      if (d > followDist) {
        e.pos.x += (dx / d) * 120 * dt;
        e.pos.y += (dy / d) * 120 * dt;
        e.facing = dx > 0 ? 1 : -1;
      }
      // Attack cooldown
      const cd = ((e.data?.atkCd as number) ?? 0) - dt;
      if (cd <= 0) {
        // find nearest enemy within 220 px
        let nearest: Entity | null = null;
        let bestD = 220 * 220;
        for (const en of state.entities.values()) {
          if (en.team !== "enemy") continue;
          const d2 = dist2(en.pos, e.pos);
          if (d2 < bestD) { bestD = d2; nearest = en; }
        }
        if (nearest) {
          spawnAllyBolt(state, e, nearest);
          e.data!.atkCd = 1.2;
        } else {
          e.data!.atkCd = 0.4;
        }
      } else {
        e.data!.atkCd = cd;
      }
    } else if (e.team === "projectile") {
      e.ttl = (e.ttl ?? 0) - dt;
      if (e.ttl <= 0) {
        state.entities.delete(e.id);
        continue;
      }
      // Serpents travel in a straight line (aim locked at spawn).
      // Hopping motion for frogs
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
        if (airborne) {
          e.pos.x += e.vel.x * dt;
          e.pos.y += e.vel.y * dt;
        }
      } else {
        e.pos.x += e.vel.x * dt;
        e.pos.y += e.vel.y * dt;
      }

      // Collide with enemies
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
      // Persistent AoE — blood pool, staff swing, gnat swarm.
      e.ttl = (e.ttl ?? 0) - dt;
      if (e.ttl <= 0) { state.entities.delete(e.id); continue; }
      // hazards may drift (gnat swarm)
      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;
      const d = e.data!;
      const dps = (d.dps as number) ?? 0;
      if (dps > 0) {
        const tick = 0.35;
        d.tickAcc = ((d.tickAcc as number) ?? tick) + dt;
        if ((d.tickAcc as number) >= tick) {
          d.tickAcc = (d.tickAcc as number) - tick;
          const r = (d.radius as number) ?? 90;
          for (const en of state.entities.values()) {
            if (en.team !== "enemy") continue;
            if (dist2(en.pos, e.pos) < r * r) {
              en.hp -= dps * tick;
              if (en.hp <= 0) killEnemy(state, en);
            }
          }
        }
      }
    } else if (e.team === "pickup") {
      // XP magnet
      const magnet = 60 + state.level * 3;
      const dx = p.pos.x - e.pos.x;
      const dy = p.pos.y - e.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < magnet) {
        const s = 220;
        e.pos.x += (dx / d) * s * dt;
        e.pos.y += (dy / d) * s * dt;
      }
      if (d < 16) {
        state.xp += (e.data?.xp as number) ?? 1;
        state.entities.delete(e.id);
        while (state.xp >= state.xpToNext) {
          levelUp(state);
        }
      }
    }
  }

  // clean up dead enemies
  for (const e of Array.from(state.entities.values())) {
    if (e.team === "enemy" && e.hp <= 0) killEnemy(state, e);
  }
}

function spawnEnemies(state: GameState, dt: number, ratePerSec: number) {
  const chance = ratePerSec * dt;
  if (Math.random() < chance) {
    const angle = Math.random() * Math.PI * 2;
    const r = 480 + Math.random() * 120;
    const p = state.player.pos;
    const isJackal = Math.random() < Math.min(0.5, state.now / 180);
    const e: Entity = {
      id: state.nextId++,
      pos: { x: p.x + Math.cos(angle) * r, y: p.y + Math.sin(angle) * r },
      vel: { x: 0, y: 0 },
      radius: isJackal ? 10 : 12,
      hp: isJackal ? 14 : 26 + state.now * 0.4,
      maxHp: isJackal ? 14 : 26 + state.now * 0.4,
      team: "enemy",
      facing: 1,
      animT: Math.random() * 10,
      born: state.now,
      kind: isJackal ? "jackal" : "soldier",
      data: {
        speed: isJackal ? 95 : 55 + state.now * 0.05,
        contactDmg: isJackal ? 12 : 10,
        xp: isJackal ? 2 : 3,
      },
    };
    state.entities.set(e.id, e);
  }
}

function castPlague(state: GameState, id: PlagueId, level: number) {
  const def = PLAGUES[id];
  const stats = def.scale(level);
  const p = state.player.pos;

  if (id === "staff") {
    // Melee staff strike — sweeps in an arc in front of Moses.
    const facing = state.player.facing;
    const range = (def.base.extra?.range ?? 70) + level * 4;
    const halfArc = (def.base.extra?.arc ?? 1.05);
    const baseAng = facing === 1 ? 0 : Math.PI;
    for (const en of state.entities.values()) {
      if (en.team !== "enemy") continue;
      const dx = en.pos.x - p.x;
      const dy = en.pos.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range + en.radius) continue;
      const ang = Math.atan2(dy, dx);
      let delta = ang - baseAng;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) <= halfArc) {
        en.hp -= stats.dmg;
        // knockback
        en.pos.x += (dx / (d || 1)) * 10;
        en.pos.y += (dy / (d || 1)) * 10;
        if (en.hp <= 0) killEnemy(state, en);
      }
    }
    // Visual swing entity (no damage on tick).
    const sw: Entity = {
      id: state.nextId++,
      pos: { x: p.x, y: p.y },
      vel: { x: 0, y: 0 },
      radius: range,
      hp: 1, maxHp: 1,
      team: "hazard", facing,
      animT: 0, born: state.now,
      ttl: 0.18,
      kind: "staffswing",
      data: { range, halfArc, facing, dps: 0 },
    };
    state.entities.set(sw.id, sw);
  } else if (id === "serpent") {
    for (let i = 0; i < stats.count; i++) {
      const spread = (i - (stats.count - 1) / 2) * 0.22;
      const baseAngle = state.player.facing === 1 ? 0 : Math.PI;
      const ang = baseAngle + spread;
      const e: Entity = {
        id: state.nextId++,
        pos: { x: p.x, y: p.y },
        vel: { x: Math.cos(ang) * stats.speed, y: Math.sin(ang) * stats.speed },
        radius: 10,
        hp: 1, maxHp: 1,
        team: "projectile", facing: state.player.facing,
        animT: 0, born: state.now,
        ttl: stats.ttl, dmg: stats.dmg,
        kind: "serpent",
        data: { t: 0, pierce: 1, hit: new Set<number>() },
      };
      state.entities.set(e.id, e);
    }
  } else if (id === "flies") {
    for (let i = 0; i < stats.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const e: Entity = {
        id: state.nextId++,
        pos: { x: p.x, y: p.y },
        vel: { x: Math.cos(ang) * stats.speed, y: Math.sin(ang) * stats.speed },
        radius: 6,
        hp: 1, maxHp: 1,
        team: "projectile", facing: 1,
        animT: 0, born: state.now,
        ttl: stats.ttl, dmg: stats.dmg,
        kind: "fly",
        data: { homing: 1, hit: new Set<number>() },
      };
      state.entities.set(e.id, e);
    }
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
        ttl: stats.ttl, dmg: stats.dmg,
        kind: "frog",
        data: { pierce: 1, hit: new Set<number>(), hopT: 0, hopDur: 0.65 },
      };
      state.entities.set(e.id, e);
    }
  } else if (id === "gnats") {
    // Drifting swarm cloud made of many tiny gnat particles.
    const count = Math.max(1, stats.count);
    for (let k = 0; k < count; k++) {
      const ang = Math.random() * Math.PI * 2;
      const radius = (def.base.extra?.radius ?? 55) + level * 4;
      // build particles for a lively cloud
      const particles: Array<{ ox: number; oy: number; phase: number; amp: number }> = [];
      const nP = 28 + Math.floor(Math.random() * 14);
      for (let i = 0; i < nP; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        particles.push({
          ox: Math.cos(a) * r,
          oy: Math.sin(a) * r * 0.75,
          phase: Math.random() * Math.PI * 2,
          amp: 2 + Math.random() * 4,
        });
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
        data: { radius, dps: stats.dmg, tickAcc: 0, particles, maxTtl: stats.ttl },
      };
      state.entities.set(e.id, e);
    }
  } else if (id === "blood") {
    // Persistent irregular pool of blood.
    const radius = (def.base.extra?.radius ?? 90) + level * 6;
    const canvas = makeBloodPoolCanvas(radius);
    const e: Entity = {
      id: state.nextId++,
      pos: { x: p.x, y: p.y },
      vel: { x: 0, y: 0 },
      radius,
      hp: 1, maxHp: 1,
      team: "hazard", facing: 1,
      animT: 0, born: state.now,
      ttl: stats.ttl,
      kind: "bloodpool",
      data: { radius, dps: stats.dmg, tickAcc: 0, canvas, maxTtl: stats.ttl },
    };
    state.entities.set(e.id, e);
  } else {
    // Fallback area-of-effect: instantaneous damage in a ring around Moses
    const radius = (def.base.extra?.radius ?? 100) + level * 4;
    for (const en of state.entities.values()) {
      if (en.team !== "enemy") continue;
      if (dist2(en.pos, p) < radius * radius) {
        en.hp -= stats.dmg;
        if (en.hp <= 0) killEnemy(state, en);
      }
    }
  }
}



function spawnAllyBolt(state: GameState, ally: Entity, target: Entity) {
  const dx = target.pos.x - ally.pos.x;
  const dy = target.pos.y - ally.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = 300;
  const e: Entity = {
    id: state.nextId++,
    pos: { x: ally.pos.x, y: ally.pos.y },
    vel: { x: (dx / d) * speed, y: (dy / d) * speed },
    radius: 5,
    hp: 1, maxHp: 1,
    team: "projectile", facing: 1,
    animT: 0, born: state.now,
    ttl: 1.4, dmg: 14 + Math.floor(state.level / 3),
    kind: "bolt",
    data: { hit: new Set<number>() },
  };
  state.entities.set(e.id, e);
}

function killEnemy(state: GameState, e: Entity) {
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
}

// ---------- leveling ----------
function levelUp(state: GameState) {
  state.xp -= state.xpToNext;
  state.level++;
  state.xpToNext = Math.floor(5 + state.level * 3 + state.level ** 1.35);
  state.player.maxHp += 5;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 15);

  // Every 5 levels unlock next companion (Elder repeats)
  if (state.level % 5 === 0) {
    unlockNextCompanion(state);
  }
  offerUpgrades(state);
}

function unlockNextCompanion(state: GameState) {
  const idx = state.nextNpcIndex;
  const npcId = idx < NPC_ORDER.length ? NPC_ORDER[idx] : "elder";
  const p = state.player.pos;
  const slot = state.npcs.size;
  const ally: Entity = {
    id: state.nextId++,
    pos: { x: p.x + Math.cos(slot) * 60, y: p.y + Math.sin(slot) * 60 },
    vel: { x: 0, y: 0 },
    radius: 12,
    hp: 60, maxHp: 60,
    team: "ally", facing: 1,
    animT: 0, born: state.now,
    kind: npcId,
    data: { slot, atkCd: 0.5, npcLabel: NPCS[npcId].name },
  };
  state.entities.set(ally.id, ally);
  state.npcs.set(npcId, ally.id);
  state.nextNpcIndex = idx + 1;
  state.newNpcs.add(npcId);
}

function offerUpgrades(state: GameState) {
  const choices: UpgradeChoice[] = [];
  const active = state.plagues;

  // Level-up options in each of the active plagues
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

  // Unlock next locked plagues
  for (const id of PLAGUE_ORDER) {
    if (active.has(id)) continue;
    const def = PLAGUES[id];
    if (state.level >= def.unlockLevel) {
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
        },
      });
    }
  }

  // Shuffle and take 3
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  const picks = choices.slice(0, 3);
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
