import type { GameState, Vec2 } from "./types";

const SPAWN_SAFETY_MARGIN = 96;

function wrap(value: number, size: number): number {
  const wrapped = value % size;
  return wrapped < 0 ? wrapped + size : wrapped;
}

/**
 * Returns a world position wholly beyond one live camera edge. The visual
 * extent and safety margin prevent large enemies from peeking onto the screen.
 */
export function offscreenEnemySpawn(state: GameState, visualExtent: number): Vec2 {
  const viewport = state.viewport ?? { w: 800, h: 600 };
  const clearance = Math.max(visualExtent, 48) + SPAWN_SAFETY_MARGIN;
  const halfW = viewport.w / 2;
  const halfH = viewport.h / 2;
  const edge = Math.floor(Math.random() * 4);
  const alongX = (Math.random() * 2 - 1) * (halfW + clearance);
  const alongY = (Math.random() * 2 - 1) * (halfH + clearance);
  let x = state.camera.x;
  let y = state.camera.y;

  if (edge === 0) {
    x -= halfW + clearance;
    y += alongY;
  } else if (edge === 1) {
    x += halfW + clearance;
    y += alongY;
  } else if (edge === 2) {
    x += alongX;
    y -= halfH + clearance;
  } else {
    x += alongX;
    y += halfH + clearance;
  }

  return { x: wrap(x, state.worldW), y: wrap(y, state.worldH) };
}