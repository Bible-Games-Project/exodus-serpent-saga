import type { GameState } from "./types";

/** Applies the one intentional Test Map exception without touching run state. */
export function resolvePlayerDefeat(state: GameState): void {
  if (state.player.hp > 0) return;
  if (state.testMap) {
    state.player.hp = state.player.maxHp;
    return;
  }
  state.gameOver = true;
  state.running = false;
}