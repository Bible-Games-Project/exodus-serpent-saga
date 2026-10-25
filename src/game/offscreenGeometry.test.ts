import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offscreenPoint, separateIndicators, indicatorBounds } from './offscreenGeometry';
const bounds = { left: 34, right: 1246, top: 90, bottom: 590 };
const camera = { x: 4096, y: 4096 }, world = { x: 8192, y: 8192 }, view = { x: 1280, y: 720 };
const point = (x: number, y: number) => offscreenPoint({ x, y }, camera, world, view, 1, bounds);
test('Ramses bounds reserve only the circle radius and arrow at each viewport edge', () => {
  const edge = indicatorBounds(1280,720,22);
  assert.deepEqual(edge,{left:34,right:1246,top:34,bottom:686});
  assert.equal(offscreenPoint({x:4096,y:6000},camera,world,view,1,edge)?.y,686);
  assert.equal(offscreenPoint({x:4096,y:2000},camera,world,view,1,edge)?.y,34);
});
test('Visible champions have no indicator', () => assert.equal(point(4500, 4200), null));
test('Right ally follows actual bearing', () => assert.deepEqual(point(6000, 4096), { x: 1246, y: 360, angle: 0, edge: 'right' }));
test('Top reserves HUD', () => assert.equal(point(4096, 2000)?.y, 90));
test('World seam follows nearest copy', () => assert.equal(offscreenPoint({ x: 7500, y: 4096 }, { x: 100, y: 4096 }, world, view, 1, bounds)?.edge, 'left'));
test('Fourteen nearby allies do not overlap', () => {
  const p = point(6000, 4096); if (!p) throw new Error('Expected point');
  const placed = separateIndicators(Array.from({ length: 14 }, () => p), bounds, 64);
  placed.forEach((v, i) => {
    assert.ok(v.x >= bounds.left); assert.ok(v.x <= bounds.right);
    assert.ok(v.y >= bounds.top); assert.ok(v.y <= bounds.bottom);
    placed.slice(0, i).forEach((other) => assert.ok(Math.hypot(v.x - other.x, v.y - other.y) >= 63.9));
  });
});
