// Gameplay entry point for sounds: `snd(state, "event.id", pos)`.
// Sounds placed in the world fade with distance from Moses and are skipped
// when far off screen, so plagues and deaths across the map stay quiet.
import type { GameState, Vec2 } from "../types";
import { sfx, type SfxOptions } from "./audioManager";

const NEAR = 380;
const FAR = 950;

function wrapDelta(a: number, b: number, size: number): number {
  let d = (b - a) % size;
  if (d > size / 2) d -= size;
  else if (d < -size / 2) d += size;
  return d;
}

export function snd(state: GameState, id: string, at?: Vec2 | null, opts?: SfxOptions) {
  if (typeof window === "undefined") return;
  let vol = opts?.volume ?? 1;
  if (at && state.player) {
    const dx = wrapDelta(state.player.pos.x, at.x, state.worldW);
    const dy = wrapDelta(state.player.pos.y, at.y, state.worldH);
    const d = Math.hypot(dx, dy);
    if (d >= FAR) return;
    if (d > NEAR) vol *= 1 - (d - NEAR) / (FAR - NEAR);
  }
  sfx(id, { ...opts, volume: vol });
}
