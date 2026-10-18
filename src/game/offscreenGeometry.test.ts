/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { offscreenPoint, separateIndicators } from './offscreenGeometry';
const bounds = { left: 34, right: 1246, top: 90, bottom: 590 };
const camera = { x: 4096, y: 4096 }, world = { x: 8192, y: 8192 }, view = { x: 1280, y: 720 };
const point = (x: number, y: number) => offscreenPoint({ x, y }, camera, world, view, 1, bounds);
test('Visible champions have no indicator', () => expect(point(4500, 4200)).toBeNull());
test('Right ally follows actual bearing', () => expect(point(6000, 4096)).toEqual({ x: 1246, y: 360, angle: 0, edge: 'right' }));
test('Top reserves HUD', () => expect(point(4096, 2000)?.y).toBe(90));
test('World seam follows nearest copy', () => expect(offscreenPoint({ x: 7500, y: 4096 }, { x: 100, y: 4096 }, world, view, 1, bounds)?.edge).toBe('left'));
test('Fourteen nearby allies do not overlap', () => {
  const p = point(6000, 4096); if (!p) throw new Error('Expected point');
  const placed = separateIndicators(Array.from({ length: 14 }, () => p), bounds, 64);
  placed.forEach((v, i) => {
    expect(v.x).toBeGreaterThanOrEqual(bounds.left); expect(v.x).toBeLessThanOrEqual(bounds.right);
    expect(v.y).toBeGreaterThanOrEqual(bounds.top); expect(v.y).toBeLessThanOrEqual(bounds.bottom);
    placed.slice(0, i).forEach((other) => expect(Math.hypot(v.x - other.x, v.y - other.y)).toBeGreaterThanOrEqual(63.9));
  });
});
