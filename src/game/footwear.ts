// Footwear (sandals) abilities: base speed, timed speed bursts, the
// "unhurt" speed bonus, teleports and the coloured footprint trail.
// Visuals live in footwearFx.ts.
import type { GameState, Vec2 } from "./types";

/** Each footwear's own colour: its glow and footprints use only shades of it. */
export const FOOTWEAR_COLOR: Record<string, string> = {
  barefoot: "#d8a060",
  patriarchs: "#b8794a",
  pilgrim: "#d9b07a",
  joshua: "#a0602e",
  wind: "#eef3fb",
  messenger: "#e0482c",
  jordan: "#4fb3e8",
  bushb: "#ff7a1a",
  invisible: "#a8c8f0",
  exodus: "#ffc83a",
};
export function footwearColor(id: string | undefined): string {
  return FOOTWEAR_COLOR[id ?? ""] ?? FOOTWEAR_COLOR.barefoot;
}

type Ability =
  | { kind: "none" }
  /** A 1-second speed burst every `every` seconds. */
  | { kind: "burst"; every: number; pct: number }
  /** Extra speed while Moses has not been hurt for `wait` seconds. */
  | { kind: "unhurt"; wait: number; pct: number }
  /** Teleport to a visible spot away from foes, then a 1-second burst.
   *  `density`: pick the spot with the fewest foes around instead of the farthest. */
  | { kind: "teleport"; every: number; pct: number; density?: boolean };

export const FOOTWEAR_ABILITY: Record<string, Ability> = {
  barefoot: { kind: "none" },
  patriarchs: { kind: "burst", every: 20, pct: 10 },
  pilgrim: { kind: "burst", every: 15, pct: 15 },
  joshua: { kind: "burst", every: 10, pct: 20 },
  wind: { kind: "unhurt", wait: 8, pct: 20 },
  messenger: { kind: "unhurt", wait: 6, pct: 25 },
  jordan: { kind: "unhurt", wait: 5, pct: 30 },
  bushb: { kind: "teleport", every: 20, pct: 10 },
  invisible: { kind: "teleport", every: 15, pct: 20 },
  exodus: { kind: "teleport", every: 10, pct: 30, density: true },
};
export const SHOE_BURST_SECONDS = 1;
/** Footprints start from the second footwear (barefoot leaves none). */
export function leavesFootprints(id: string | undefined): boolean {
  return !!id && id !== "barefoot" && id in FOOTWEAR_ABILITY;
}
/** Prints visible behind Moses: 3 with the Patriarchs, one more per pair, up to 10. */
export function footprintCount(id: string | undefined): number {
  const i = Object.keys(FOOTWEAR_ABILITY).indexOf(id ?? "");
  return i < 1 ? 0 : Math.min(10, i + 2);
}
/** A foe stepping on a print walks 15% slower for 1 second. */
export const PRINT_SLOW = { pct: 15, seconds: 1 } as const;
const PRINT_STEP = 15; // world px walked between two prints
const PRINT_LIFE = 1.6; // seconds
export const FOOTPRINT_LIFE = PRINT_LIFE;

function fx(state: GameState): Record<string, number> {
  return (state.equipFx ??= {});
}

/** Speed multiplier from the footwear's ability (on top of its base speed). */
export function footwearAbilityMul(state: GameState): number {
  const f = state.equipFx;
  if (!f) return 1;
  let mul = 1;
  if (state.now < (f.shoeBurstUntil ?? -1)) mul *= 1 + (f.shoeBurstPct ?? 0) / 100;
  if (f.shoeUnhurt) mul *= 1 + (f.shoeUnhurtPct ?? 0) / 100;
  return mul;
}

/** How strongly the shoes glow right now (0..1). */
export function footwearGlow(state: GameState): number {
  const f = state.equipFx;
  if (!f) return 0;
  const now = state.now;
  let k = 0;
  const burstLeft = (f.shoeBurstUntil ?? -1) - now;
  if (burstLeft > 0) k = Math.max(k, Math.min(1, (now - (f.shoeBurstAt ?? now)) / .1, burstLeft / .25));
  if (f.shoeUnhurt) k = Math.max(k, Math.min(1, (now - (f.shoeUnhurtAt ?? now)) / .25) * (.7 + .3 * Math.sin(now * 5)));
  return Math.max(0, k);
}

function wrapD(a: number, b: number, m: number): number {
  let d = a - b;
  d = ((d + m / 2) % m + m) % m - m / 2;
  return d;
}
function wrap(v: number, m: number): number {
  return ((v % m) + m) % m;
}

function burst(state: GameState, pct: number): void {
  const f = fx(state);
  f.shoeBurstAt = state.now;
  f.shoeBurstUntil = state.now + SHOE_BURST_SECONDS;
  f.shoeBurstPct = pct;
}

/** A visible spot (inside the screen) away from foes; null if none is free. */
export function teleportSpot(state: GameState, density: boolean): Vec2 | null {
  const vw = state.viewport?.w ?? 800, vh = state.viewport?.h ?? 600;
  const foes: Vec2[] = [];
  for (const en of state.entities.values()) if (en.team === "enemy" && en.hp > 0 && !en.data?.sealed) foes.push(en.pos);
  const p = state.player;
  let best: Vec2 | null = null, bestScore = -Infinity;
  const mx = Math.max(40, vw / 2 - 70), my = Math.max(40, vh / 2 - 80);
  for (let i = 0; i < 48; i++) {
    const c = { x: wrap(state.camera.x + (Math.random() * 2 - 1) * mx, state.worldW), y: wrap(state.camera.y + (Math.random() * 2 - 1) * my, state.worldH) };
    if (state.obstacles?.some((o) => Math.hypot(wrapD(c.x, o.pos.x, state.worldW), wrapD(c.y, o.pos.y, state.worldH)) < o.r + p.radius + 6)) continue;
    let near = Infinity, crowd = 0;
    for (const q of foes) {
      const d = Math.hypot(wrapD(c.x, q.x, state.worldW), wrapD(c.y, q.y, state.worldH));
      if (d < near) near = d;
      if (d < 180) crowd += 1 - d / 180;
    }
    near = Math.min(near, 900);
    const score = density ? -crowd * 1000 + near : near;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

type Print = NonNullable<GameState["footprints"]>[number];

export function updateFootwear(state: GameState): void {
  const id = state.loadout?.footwear.id;
  if (!id) return;
  const f = fx(state);
  const p = state.player;
  const now = state.now;
  const ab = FOOTWEAR_ABILITY[id] ?? { kind: "none" };
  if (p.hp <= 0) return;
  // Swapping footwear (Test Map) starts its ability from scratch.
  if (f.shoeKind !== Object.keys(FOOTWEAR_ABILITY).indexOf(id)) {
    f.shoeKind = Object.keys(FOOTWEAR_ABILITY).indexOf(id);
    for (const k of ["shoeNext", "shoeQuietFrom", "shoeUnhurt", "shoeBurstUntil"]) delete f[k];
  }

  if (ab.kind === "burst") {
    f.shoeNext ??= now + ab.every;
    if (now >= f.shoeNext) { f.shoeNext = now + ab.every; burst(state, ab.pct); }
  } else if (ab.kind === "unhurt") {
    f.shoeQuietFrom ??= now;
    const last = Math.max(f.lastDamageAt ?? -Infinity, f.shoeQuietFrom);
    const on = now - last >= ab.wait ? 1 : 0;
    if (on && !f.shoeUnhurt) f.shoeUnhurtAt = now;
    f.shoeUnhurt = on;
    f.shoeUnhurtPct = ab.pct;
  } else if (ab.kind === "teleport") {
    f.shoeNext ??= now + ab.every;
    if (now >= f.shoeNext) {
      f.shoeNext = now + ab.every;
      const to = teleportSpot(state, !!ab.density);
      if (to) {
        f.shoeTeleAt = now; f.shoeTeleFromX = p.pos.x; f.shoeTeleFromY = p.pos.y;
        p.pos.x = to.x; p.pos.y = to.y;
        f.shoePrintX = to.x; f.shoePrintY = to.y;
        burst(state, ab.pct);
      }
    }
  }

  // Coloured footprints while walking.
  const prints = (state.footprints ??= []);
  while (prints.length && now - prints[0].at > PRINT_LIFE) prints.shift();
  const keep = footprintCount(id);
  while (prints.length > keep) prints.shift();
  // Foes touching a print are slowed.
  if (prints.length) {
    for (const en of state.entities.values()) {
      if (en.team !== "enemy" || en.hp <= 0 || en.data?.sealed) continue;
      for (const q of prints) {
        const d = Math.hypot(wrapD(en.pos.x, q.x, state.worldW), wrapD(en.pos.y + 8, q.y, state.worldH));
        if (d < en.radius + 6) { (en.data ??= {}).printSlowUntil = now + PRINT_SLOW.seconds; break; }
      }
    }
  }
  if (!leavesFootprints(id)) return;
  const speed = Math.hypot(p.vel.x, p.vel.y);
  if (speed < 5) { f.shoePrintX = p.pos.x; f.shoePrintY = p.pos.y; return; }
  f.shoePrintX ??= p.pos.x; f.shoePrintY ??= p.pos.y;
  const dx = wrapD(p.pos.x, f.shoePrintX, state.worldW), dy = wrapD(p.pos.y, f.shoePrintY, state.worldH);
  if (Math.hypot(dx, dy) < PRINT_STEP) return;
  f.shoePrintX = p.pos.x; f.shoePrintY = p.pos.y;
  f.shoePrintSide = f.shoePrintSide === 1 ? -1 : 1;
  const a = Math.atan2(p.vel.y, p.vel.x);
  const side = f.shoePrintSide;
  const print: Print = { x: p.pos.x - Math.sin(a) * side * 4, y: p.pos.y + 8 + Math.cos(a) * side * 2, a, side, at: now };
  prints.push(print);
  while (prints.length > keep) prints.shift();
}
