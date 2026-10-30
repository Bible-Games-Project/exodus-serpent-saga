// Combat-only assets; shop artwork is deliberately not imported here.
import whirlpoolUrl from '@/assets/combat-whirlpool-polish.png';
const sources = import.meta.glob<string>('../assets/combat-*-polish-*.png', { eager: true, query: '?url', import: 'default' });
const cache = new Map<string, HTMLImageElement>();
function image(url: string | undefined): HTMLImageElement | null {
  if (!url || typeof Image === 'undefined') return null;
  let img = cache.get(url);
  if (!img) { img = new Image(); img.src = url; cache.set(url, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
export function drawWeaponPng(ctx: CanvasRenderingContext2D, id: string, evolution: number): boolean {
  const img = image(sources[`../assets/combat-${id}-polish-${evolution}.png`]);
  if (!img) return false;
  const height = id === 'dagger' ? 35 : id === 'sword' ? 48 * ([1, 1.5, 2][evolution - 1] ?? 1) : id === 'ring' ? 23 : 53;
  const width = height * img.naturalWidth / img.naturalHeight;
  // Axe shafts sit left of the blade; every other grip is central.
  const gripX = id === 'axe' ? .24 : .5;
  const gripY = id === 'ring' ? .8 : .86;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -width * gripX, -height * gripY, width, height);
  return true;
}
export function drawWeaponImpact(ctx: CanvasRenderingContext2D, kind: 'whirlpool' | 'axe' | 'mace', x: number, y: number, width: number, height: number, angle = 0, alpha = 1): void {
  const img = image(kind === 'whirlpool' ? whirlpoolUrl : sources[`../assets/combat-fx-polish-${kind === 'axe' ? 2 : 3}.png`]);
  if (!img) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();
}