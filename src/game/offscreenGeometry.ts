import type { Vec2 } from './types';
export type IndicatorPoint = Vec2 & { angle: number; edge: 'left' | 'right' | 'top' | 'bottom' };
export type IndicatorBounds = { left: number; right: number; top: number; bottom: number };
export const wrappedDelta = (delta: number, size: number) => delta - Math.round(delta / size) * size;
export function offscreenPoint(pos: Vec2, camera: Vec2, world: Vec2, view: Vec2, zoom: number, bounds: IndicatorBounds): IndicatorPoint | null {
  const dx = wrappedDelta(pos.x - camera.x, world.x) * zoom, dy = wrappedDelta(pos.y - camera.y, world.y) * zoom;
  const cx = view.x / 2, cy = view.y / 2, x = cx + dx, y = cy + dy;
  if (x >= 0 && x <= view.x && y >= 0 && y <= view.y) return null;
  const tx = dx > 0 ? (bounds.right - cx) / dx : dx < 0 ? (bounds.left - cx) / dx : Infinity;
  const ty = dy > 0 ? (bounds.bottom - cy) / dy : dy < 0 ? (bounds.top - cy) / dy : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t, angle: Math.atan2(dy, dx), edge: tx < ty ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom') };
}
export function separateIndicators(points: IndicatorPoint[], bounds: IndicatorBounds, spacing: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  for (const point of points) {
    let placed = { ...point }, found = false;
    const vertical = point.edge === 'left' || point.edge === 'right';
    for (let lane = 0; lane < points.length && !found; lane++) {
      for (let step = 0; step < points.length * 2 + 1; step++) {
        const offset = Math.ceil(step / 2) * spacing * (step % 2 ? 1 : -1);
        const x = vertical ? point.x + lane * spacing * (point.edge === 'left' ? 1 : -1) : point.x + offset;
        const y = vertical ? point.y + offset : point.y + lane * spacing * (point.edge === 'top' ? 1 : -1);
        if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
        if (result.some((p) => Math.hypot(x - p.x, y - p.y) < spacing - 0.1)) continue;
        placed = { ...point, x, y }; found = true; break;
      }
    }
    result.push(placed);
  }
  return result;
}
