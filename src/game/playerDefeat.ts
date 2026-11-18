import type { GameState } from "./types";
import { snd } from "./audio/gameSound";

/** Applies the one intentional Test Map exception without touching run state. */
export function resolvePlayerDefeat(state: GameState): void {
  if (state.player.hp > 0) return;
  if (state.testMap) {
    state.player.hp = state.player.maxHp;
    return;
  }
  // Fruit of the Tree of Life: one resurrection per run, half health, no shield.
  if (state.loadout?.food.resurrect && !state.resurrectUsed) {
    state.resurrectUsed = true;
    state.player.hp = Math.round(state.player.maxHp / 2);
    state.shield = 0;
    snd(state, "player.revive");
    return;
  }
  state.gameOver = true;
  state.running = false;
  snd(state, "player.death");
  snd(state, "event.gameover", null, { delay: 1.2 });
}