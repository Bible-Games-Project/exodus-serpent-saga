import type { Entity, GameState } from './types';
import { allyDef } from './allies';
import { NPCS } from './npcs';
import { offscreenPoint, separateIndicators, type IndicatorPoint } from './offscreenGeometry';
import aaron from '@/assets/shop-portrait-aaron.png.asset.json';
import miriam from '@/assets/shop-portrait-miriam.png.asset.json';
import jochebed from '@/assets/shop-portrait-jochebed.png.asset.json';
import ramses from '@/assets/ramses-quiet-body.png.asset.json';
const portraits: Record<string, string> = { aaron: aaron.url, miriam: miriam.url, jochebed: jochebed.url, ramses: ramses.url };
const images = new Map<string, HTMLImageElement>(), faces = new Map<string, HTMLCanvasElement>();
let palette: Record<string, string> | null = null;
function colors() {
  if (palette) return palette;
  const css = getComputedStyle(document.documentElement);
  palette = Object.fromEntries(['ally-dark', 'ally-light', 'enemy-dark', 'enemy-light', 'dead-dark', 'dead-light', 'ink', 'health', 'critical'].map((name) => [name, css.getPropertyValue(`--indicator-${name}`).trim()]));
  return palette;
}
function face(e: Entity, dead: boolean, color: Record<string, string>) {
  const key = `${e.kind}:${dead}`, cached = faces.get(key);
  if (cached) return cached;
  const def = allyDef(e.kind), url = portraits[e.kind] ?? def?.sprite.url;
  if (!url) return null;
  let image = images.get(url);
  if (!image) { image = new Image(); image.src = url; images.set(url, image); }
  if (!image.complete || !image.naturalWidth) return null;
  const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 24;
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  if (e.kind === 'ramses') ctx.drawImage(image, 3, 0, 65, 54, 0, 0, 24, 24);
  else if (portraits[e.kind]) ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, 24, 24);
  else if (def) ctx.drawImage(image, Math.max(0, def.sprite.CX - 13), 0, 26, 30, 0, 0, 24, 24);
  const mode = dead ? 'dead' : e.kind === 'ramses' ? 'enemy' : 'ally';
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dark = rgb(color[`${mode}-dark`]), light = rgb(color[`${mode}-light`]), pixels = ctx.getImageData(0, 0, 24, 24);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const lum = (pixels.data[i] * 0.3 + pixels.data[i + 1] * 0.59 + pixels.data[i + 2] * 0.11) / 255;
    for (let c = 0; c < 3; c++) pixels.data[i + c] = dark[c] + (light[c] - dark[c]) * lum;
  }
  ctx.putImageData(pixels, 0, 0); faces.set(key, canvas); return canvas;
}
export function drawOffscreenIndicators(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number, zoom: number) {
  if (state.gameOver || state.paused || state.levelUpPending) return;
  const size = width < 600 || height < 500 ? 36 : 44, radius = size / 2, margin = radius + 12;
  const bounds = { left: margin, right: width - margin, top: Math.max(margin, height < 500 ? 65 : 90), bottom: height - (height < 500 ? 90 : 130) };
  if (bounds.bottom <= bounds.top || bounds.right <= bounds.left) return;
  const targets: Array<{ entity: Entity; point: IndicatorPoint; name: string }> = [];
  const add = (entity: Entity, name: string) => {
    const point = offscreenPoint(entity.pos, state.camera, { x: state.worldW, y: state.worldH }, { x: width, y: height }, zoom, bounds);
    if (point) targets.push({ entity, point, name });
  };
  for (const [id, entityId] of state.npcs) { const entity = state.entities.get(entityId); if (entity) add(entity, NPCS[id]?.name ?? id); }
  const boss = state.ramsesId == null ? undefined : state.entities.get(state.ramsesId); if (boss) add(boss, 'Ramses');
  const packed = separateIndicators(targets.map((t) => t.point), bounds, size + 20), color = colors();
  ctx.save(); ctx.imageSmoothingEnabled = false;
  targets.forEach(({ entity, name }, i) => {
    const point = packed[i]; if (!point) return;
    const { x, y, angle } = point, dead = entity.hp <= 0 || entity.data?.downedUntil != null;
    const ratio = dead ? 0 : Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
    const mode = dead ? 'dead' : entity.kind === 'ramses' ? 'enemy' : 'ally';
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    ctx.save(); ctx.rotate(angle); ctx.fillStyle = color[`${mode}-light`];
    ctx.beginPath(); ctx.moveTo(radius + 8, 0); ctx.lineTo(radius + 2, -4); ctx.lineTo(radius + 2, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = color.ink; ctx.beginPath(); ctx.arc(0, 0, radius + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color[`${mode}-dark`]; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, radius - 2, 0, Math.PI * 2); ctx.clip();
    const art = face(entity, dead, color); if (art) ctx.drawImage(art, -radius + 2, -radius + 2, size - 4, size - 4); ctx.restore();
    ctx.strokeStyle = color[`${mode}-light`]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color.ink; ctx.fillRect(-radius, radius - 5, size, 7);
    ctx.fillStyle = ratio <= 0.2 ? color.critical : color.health; ctx.fillRect(-radius + 2, radius - 3, Math.round((size - 4) * ratio), 3);
    ctx.font = '10px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineWidth = 3; ctx.strokeStyle = color.ink;
    ctx.strokeText(name, 0, radius + 5, size + 14); ctx.fillStyle = color[`${mode}-light`]; ctx.fillText(name, 0, radius + 5, size + 14);
    if (dead) { ctx.strokeStyle = color['dead-light']; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke(); }
    ctx.restore();
  });
  ctx.restore();
}
