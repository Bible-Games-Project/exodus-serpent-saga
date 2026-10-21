// Shop champion artwork. One aligned chest-up portrait per champion (shared
// 1024x1024 composition: same head height and bottom-to-head spacing); the
// sidebar face is a fixed crop of that same image, so no weapons appear.
import moses from "@/assets/shop-portrait-v3-moses.png.asset.json";

const PORTRAITS = import.meta.glob<{ default: { url: string } }>("@/assets/shop-portrait-v3-*.png.asset.json", { eager: true });
const BY_ID: Record<string, string> = {};
for (const [path, mod] of Object.entries(PORTRAITS)) {
  const m = path.match(/shop-portrait-v3-([a-z]+)\.png\.asset\.json$/);
  if (m) BY_ID[m[1]] = mod.default.url;
}
export const MOSES_PORTRAIT = moses.url;

// Face crop inside the 1024 composition: x 352–672, y 190–510.
const FACE = { x: 352 / 1024, y: 190 / 1024, w: 320 / 1024 };

export function ChampionArt({ id, url, alt = "", face, size }: { id?: string; url?: string; alt?: string; face?: boolean; size?: number }) {
  const src = url ?? (id ? BY_ID[id] : undefined) ?? MOSES_PORTRAIT;
  if (!face) return <img src={src} alt={alt} className="shop-stage-art" />;
  const s = size ?? 64;
  const full = s / FACE.w;
  return (
    <span className="shop-icon-box shop-face shrink-0" style={{ width: s, height: s }}>
      <img src={src} alt={alt} loading="lazy" style={{ width: full, height: full, left: -FACE.x * full, top: -FACE.y * full }} />
    </span>
  );
}
