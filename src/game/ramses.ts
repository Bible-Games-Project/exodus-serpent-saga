// Ramses world boss. Sits idle on his throne near the spawn point until
// the player unlocks the Plague of Darkness, then activates and pursues Moses
// with periodic superhero-landing leaps.
import type { Entity, GameState, Vec2 } from "./types";

const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function spawnRamses(state: GameState): void {
  const cx = state.player.pos.x + 160;
  const cy = state.player.pos.y - 40;
  const r: Entity = {
    id: state.nextId++,
    pos: { x: cx, y: cy },
    vel: { x: 0, y: 0 },
    radius: 22,
    hp: 5000, maxHp: 5000,
    team: "enemy",
    facing: -1,
    animT: 0,
    born: state.now,
    kind: "ramses",
    data: {
      category: "human",
      speed: 70,
      contactDmg: 20,
      xp: 0,
      seated: true,
      active: false,
      throneX: cx,
      throneY: cy,
      leapCd: 8,
      leapPhase: "idle", // "idle" | "telegraph" | "airborne" | "land"
      leapT: 0,
      leapTarget: { x: cx, y: cy } as Vec2,
      leapFrom: { x: cx, y: cy } as Vec2,
      landRadius: 90,
      landDmg: 40,
      immuneFirstborn: true,
      immuneFire: true,
    },
  };
  state.entities.set(r.id, r);
  state.ramsesId = r.id;
}

// Called every frame in engine update.
export function tickRamses(state: GameState, dt: number, helpers: { resolveObstacles: (pos: Vec2, r: number) => void }): void {
  const id = state.ramsesId;
  if (id == null) return;
  const r = state.entities.get(id);
  if (!r) return;
  const d = r.data!;
  const p = state.player;

  // Activation trigger — 10th plague = darkness unlocked.
  if (!d.active && state.plagues.has("darkness")) {
    d.active = true;
    d.seated = false;
    d.leapCd = 3;
  }
  if (!d.active) return;

  const phase = d.leapPhase as string;

  if (phase === "idle") {
    // Slowly walk toward Moses.
    const dx = p.pos.x - r.pos.x;
    const dy = p.pos.y - r.pos.y;
    const dd = Math.hypot(dx, dy) || 1;
    const spd = 70;
    r.pos.x += (dx / dd) * spd * dt;
    r.pos.y += (dy / dd) * spd * dt;
    helpers.resolveObstacles(r.pos, r.radius);
    r.facing = dx > 0 ? 1 : -1;

    // Contact damage
    if (dist2(r.pos, p.pos) < (r.radius + p.radius) ** 2 && !isInvuln(state)) {
      p.hp -= 30 * dt;
    }

    const cd = ((d.leapCd as number) ?? 0) - dt;
    if (cd <= 0) {
      d.leapPhase = "telegraph";
      d.leapT = 0.9;
      d.leapTarget = { x: p.pos.x, y: p.pos.y };
      d.leapFrom = { x: r.pos.x, y: r.pos.y };
    } else {
      d.leapCd = cd;
    }
  } else if (phase === "telegraph") {
    // Track player briefly then commit.
    d.leapT = ((d.leapT as number) ?? 0) - dt;
    const tp = d.leapTarget as Vec2;
    // Slight tracking bias while telegraphing (first half).
    if ((d.leapT as number) > 0.45) {
      tp.x = tp.x * 0.75 + p.pos.x * 0.25;
      tp.y = tp.y * 0.75 + p.pos.y * 0.25;
    }
    if ((d.leapT as number) <= 0) {
      d.leapPhase = "airborne";
      d.leapT = 0.75;
      d.leapFrom = { x: r.pos.x, y: r.pos.y };
    }
  } else if (phase === "airborne") {
    d.leapT = ((d.leapT as number) ?? 0) - dt;
    const total = 0.75;
    const t = 1 - Math.max(0, Math.min(1, (d.leapT as number) / total));
    const from = d.leapFrom as Vec2;
    const to = d.leapTarget as Vec2;
    r.pos.x = from.x + (to.x - from.x) * t;
    r.pos.y = from.y + (to.y - from.y) * t;
    if ((d.leapT as number) <= 0) {
      d.leapPhase = "land";
      d.leapT = 0.4;
      r.pos.x = to.x; r.pos.y = to.y;
      // impact: damage player if in circle, screen shake.
      const R = d.landRadius as number;
      if (dist2(r.pos, p.pos) < R * R && !isInvuln(state)) {
        p.hp -= d.landDmg as number;
        if (p.hp <= 0) { state.gameOver = true; state.running = false; }
      }
      state.screenShake = Math.max(state.screenShake ?? 0, 14);
    }
  } else if (phase === "land") {
    d.leapT = ((d.leapT as number) ?? 0) - dt;
    if ((d.leapT as number) <= 0) {
      d.leapPhase = "idle";
      d.leapCd = 7 + Math.random() * 3;
    }
  }
}

function isInvuln(state: GameState): boolean {
  return state.now < (state.invulnUntil ?? 0);
}
