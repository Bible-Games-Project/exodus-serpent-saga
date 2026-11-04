// Combat-only assets; shop artwork is deliberately not imported here.
import whirlpoolUrl from '@/assets/combat-whirlpool-polish.png';
import dagger1Asset from '@/assets/combat-dagger-clean-1.png.asset.json';
import dagger2Asset from '@/assets/combat-dagger-clean-2.png.asset.json';
import dagger3Asset from '@/assets/combat-dagger-clean-3.png.asset.json';
import sword1Asset from '@/assets/combat-sword-clean-1.png.asset.json';
import sword2Asset from '@/assets/combat-sword-clean-2.png.asset.json';
import sword3Asset from '@/assets/combat-sword-clean-3.png.asset.json';
import axe1Asset from '@/assets/combat-axe-clean-1.png.asset.json';
import axe2Asset from '@/assets/combat-axe-clean-2.png.asset.json';
import axe3Asset from '@/assets/combat-axe-clean-3.png.asset.json';
const [dagger1, dagger2, dagger3] = [dagger1Asset.url, dagger2Asset.url, dagger3Asset.url];
const [sword1, sword2, sword3] = [sword1Asset.url, sword2Asset.url, sword3Asset.url];
const [axe1, axe2, axe3] = [axe1Asset.url, axe2Asset.url, axe3Asset.url];
import mace1Asset from '@/assets/combat-mace-supplied-1.png.asset.json';
import mace2Asset from '@/assets/combat-mace-supplied-2.png.asset.json';
import mace3Asset from '@/assets/combat-mace-supplied-3.png.asset.json';
import ring1Asset from '@/assets/combat-ring-supplied-1.png.asset.json';
import ring2Asset from '@/assets/combat-ring-supplied-2.png.asset.json';
import ring3Asset from '@/assets/combat-ring-supplied-3.png.asset.json';
import branchWindAsset from '@/assets/combat-branch-wind.png.asset.json';
import maceImpactAsset from '@/assets/combat-mace-impact-supplied.png.asset.json';
const [ring1, ring2, ring3] = [ring1Asset.url, ring2Asset.url, ring3Asset.url];
const [mace1, mace2, mace3] = [mace1Asset.url, mace2Asset.url, mace3Asset.url];
import fx2 from '@/assets/combat-fx-polish-2.png';
import fx3 from '@/assets/combat-fx-polish-3.png';
const sources: Record<string, string> = {'../assets/combat-dagger-polish-1.png': dagger1, '../assets/combat-dagger-polish-2.png': dagger2, '../assets/combat-dagger-polish-3.png': dagger3, '../assets/combat-sword-polish-1.png': sword1, '../assets/combat-sword-polish-2.png': sword2, '../assets/combat-sword-polish-3.png': sword3, '../assets/combat-axe-polish-1.png': axe1, '../assets/combat-axe-polish-2.png': axe2, '../assets/combat-axe-polish-3.png': axe3, '../assets/combat-mace-polish-1.png': mace1, '../assets/combat-mace-polish-2.png': mace2, '../assets/combat-mace-polish-3.png': mace3, '../assets/combat-ring-polish-1.png': ring1, '../assets/combat-ring-polish-2.png': ring2, '../assets/combat-ring-polish-3.png': ring3, '../assets/combat-fx-polish-2.png': fx2, '../assets/combat-fx-polish-3.png': fx3};
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
  const height = id === 'dagger' ? 35 : id === 'sword' ? 48 * ([1, 1.5, 2][evolution - 1] ?? 1) : id === 'ring' ? 26 : id === 'mace' ? 56 : 53;
  const width = height * img.naturalWidth / img.naturalHeight;
  // Axe shafts sit left of the blade; every other grip is central.
  const grips: Record<string, readonly (readonly [number, number])[]> = {
    dagger: [[.602,.815],[.613,.831],[.603,.849]],
    axe: [[.823,.85],[.405,.826],[.548,.832]],
    // Grip at the middle of each hilt (between guard and pommel).
    sword: [[.5,.79],[.5,.85],[.5,.9]],
    mace: [[.5,.88],[.5,.89],[.5,.88]],
  };
  const [gripX, gripY] = grips[id]?.[evolution - 1] ?? [.5, id === 'ring' ? .5 : .86];
  // Axe art faces backwards; mirror so the blade leads toward the target.
  if (id === 'axe') { ctx.save(); ctx.scale(-1, 1); }
  // Supplied high-resolution weapons retain their soft painted edges at native
  // combat size; nearest-neighbour sampling would break thin blade details.
  ctx.imageSmoothingEnabled = ['dagger', 'sword', 'axe', 'mace', 'ring'].includes(id);
  ctx.drawImage(img, -width * gripX, -height * gripY, width, height);
  if (id === 'axe') ctx.restore();
  return true;
}
/** Supplied painted FX drawn with smoothing; anchor (ax, ay) is a fraction of the image. */
export function drawSuppliedFx(ctx: CanvasRenderingContext2D, kind: 'branchwind' | 'maceimpact', width: number, ax = .5, ay = .5, alpha = 1): boolean {
  const img = image(kind === 'branchwind' ? branchWindAsset.url : maceImpactAsset.url);
  if (!img) return false;
  const height = width * img.naturalHeight / img.naturalWidth;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, -width * ax, -height * ay, width, height);
  ctx.restore();
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