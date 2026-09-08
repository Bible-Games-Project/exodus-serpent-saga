// Ramses world boss. Sits idle on his throne near spawn until player reaches
// level 10, then activates and pursues Moses. Leap attack only unlocks after
// the player learns the Death of the Firstborn plague.
import type { Entity, GameState, Vec2 } from "./types";
import { shieldDamageMul } from "./bonuses";

const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function spawnRamses(state: GameState): void {
  const cx = state.player.pos.x + 180;
  const cy = state.player.pos.y - 40;

  const r: Entity = {
    id: state.nextId++,
    pos: { x: cx, y: cy },
    vel: { x: 0, y: 0 },
    radius: 28,
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
      leapUnlocked: false,   // unlocks at player level 36
      chariot: false,        // mounts war chariot at player level 50
      spearCd: 0,
      smashR: 110,
      crackT: 0,
      crackSeed: 1,
      leapPhase: "idle",
      leapT: 0,
      leapTarget: { x: cx, y: cy } as Vec2,
      leapFrom: { x: cx, y: cy } as Vec2,
      landRadius: 100,
      landDmg: 45,
      immuneFirstborn: true,
      immuneFire: false,     // Fire from Heaven damages but does not kill Ramses
    },
  };
  state.entities.set(r.id, r);
  state.ramsesId = r.id;
}

// Called every frame in engine update.
export function tickRamses(state: GameState, dt: number, helpers: { resolveObstacles: (pos: Vec2, r: number) => void; spawnEnemyProjectile: (owner: Entity, dir: Vec2, kind: string, spd: number, dmg: number, ttl: number) => void }): void {
  const id = state.ramsesId;
  if (id == null) return;
  const r = state.entities.get(id);
  if (!r) return;
  const d = r.data!;
  const p = state.player;

  // Activation trigger — player reaches level 18: Ramses leaves his throne.
  if (!d.active && state.level >= 18) {
    d.active = true;
    d.seated = false;
    d.leapCd = 5;
    d.atkPhase = "idle";
    d.atkT = 0;
    d.atkCd = 1.5;
  }
  // Leap (jumping) attack unlocks at player level 36.
  if (!d.leapUnlocked && state.level >= 36) {
    d.leapUnlocked = true;
  }
  // Chariot unlocks at player level 50 — Ramses mounts a war chariot.
  if (!d.chariot && state.level >= 50) {
    d.chariot = true;
    r.radius = 34;
    d.spearCd = 2;
    d.contactDmg = 32;
  }
  if (!d.active) {
    return;
  }

  const phase = d.leapPhase as string;
  const chariot = !!d.chariot;

  // ---- Ground smash ----
  // Wind-up (staff raised overhead) → smash into the ground (damage in a radius
  // at that instant, cracks + dust + screen shake) → recover, then a cooldown.
  // He stands still for the whole attack so it is readable.
  const atk = (d.atkPhase as string) ?? "idle";
  const MELEE_RANGE = r.radius + p.radius + 34;
  const SMASH_R = (d.smashR as number) ?? 110;
  // Ground cracks/dust linger briefly after the impact, then vanish.
  if ((d.crackT as number) > 0) d.crackT = (d.crackT as number) - dt;
  if (phase === "idle" && atk !== "idle") {
    d.atkT = ((d.atkT as number) ?? 0) - dt;
    if ((d.atkT as number) <= 0) {
      if (atk === "windup") {
        // Staff slams into the ground: damage is dealt only at this instant.
        d.atkPhase = "smash";
        d.atkT = 0.12;
        d.crackT = 0.55;
        d.crackSeed = 1 + Math.random() * 999;
        if (dist2(r.pos, p.pos) < SMASH_R * SMASH_R && !isInvuln(state)) {
          p.hp -= 38 * shieldDamageMul(state);
          state.damageImpactKind = "ramses";
          if (p.hp <= 0) { state.gameOver = true; state.running = false; }
        }
        state.screenShake = Math.max(state.screenShake ?? 0, 11);
      } else if (atk === "smash") {
        d.atkPhase = "recover";
        d.atkT = 0.45;
      } else {
        d.atkPhase = "idle";
        d.atkCd = 1.8 + Math.random() * 0.9;
      }
    }
    return;
  }

  if (phase === "idle") {
    const dx = p.pos.x - r.pos.x;
    const dy = p.pos.y - r.pos.y;
    const dd = Math.hypot(dx, dy) || 1;
    r.facing = dx > 0 ? 1 : -1;

    // Start a strike when close enough and off cooldown; otherwise chase.
    const cdA = ((d.atkCd as number) ?? 0) - dt;
    d.atkCd = cdA;
    if (!chariot && dd < MELEE_RANGE && cdA <= 0) {
      d.atkPhase = "windup";
      d.atkT = 0.55;
      return;
    }

    // Chase Moses. Faster and heavier when mounted on the chariot.
    const spd = chariot ? 140 : 70;
    if (dd > MELEE_RANGE * 0.8 || chariot) {
      r.pos.x += (dx / dd) * spd * dt;
      r.pos.y += (dy / dd) * spd * dt;
      helpers.resolveObstacles(r.pos, r.radius);
    }

    // Contact damage
    if (dist2(r.pos, p.pos) < (r.radius + p.radius) ** 2 && !isInvuln(state)) {
      p.hp -= (chariot ? 45 : 30) * dt * shieldDamageMul(state);
      state.damageImpactKind = "ramses";
      if (p.hp <= 0) { state.gameOver = true; state.running = false; }
    }

    // Chariot: throw flaming spears at Moses.
    if (chariot) {
      const scd = ((d.spearCd as number) ?? 2) - dt;
      if (scd <= 0 && dd < 520) {
        helpers.spawnEnemyProjectile(r, { x: dx / dd, y: dy / dd }, "flamingspear", 340, 22, 1.6);
        d.spearCd = 2.4 + Math.random() * 0.9;
      } else {
        d.spearCd = scd;
      }
    }

    if (d.leapUnlocked) {
      const cd = ((d.leapCd as number) ?? 0) - dt;
      if (cd <= 0) {
        d.leapPhase = "telegraph";
        d.leapT = 0.9;
        d.leapTarget = { x: p.pos.x, y: p.pos.y };
        d.leapFrom = { x: r.pos.x, y: r.pos.y };
      } else {
        d.leapCd = cd;
      }
    }
  } else if (phase === "telegraph") {

    d.leapT = ((d.leapT as number) ?? 0) - dt;
    const tp = d.leapTarget as Vec2;
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
      const R = d.landRadius as number;
      if (dist2(r.pos, p.pos) < R * R && !isInvuln(state)) {
        p.hp -= (d.landDmg as number) * shieldDamageMul(state);
        state.damageImpactKind = "ramses";
        if (p.hp <= 0) { state.gameOver = true; state.running = false; }
      }
      state.screenShake = Math.max(state.screenShake ?? 0, 16);
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

// Returns true when Ramses is currently untouchable by player attacks.
export function ramsesImmune(e: Entity): boolean {
  return !!(e.data && e.data.seated);
}

