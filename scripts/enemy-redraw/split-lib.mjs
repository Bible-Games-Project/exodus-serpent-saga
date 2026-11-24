import fs from "fs"; import { PNG } from "pngjs";
export const read = (f) => PNG.sync.read(fs.readFileSync(f));
export const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
/**
 * Downsample a hi-res image to figure height `th` (figure top..bottom = topY..bbox bottom),
 * labelling each low-res pixel by majority of label(x,y,r,g,b) over its block.
 * Returns { W, H, s, ox, oy, px: Array<{r,g,b,a,label}|null> } with 1px margin.
 */
export function downsample(im, th, label, topY, margin = 1) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (im.data[(y*im.width+x)*4+3] > 40) { x0 = Math.min(x0,x); x1 = Math.max(x1,x); y0 = Math.min(y0,y); y1 = Math.max(y1,y); }
  const fy = topY ?? y0; const s = (y1 - fy + 1) / th;
  const ox = x0 - margin * s, oy = y1 + 1 - (th + Math.ceil((fy - y0) / s)) * s - margin * s;
  const W = Math.ceil((x1 + 1 - ox) / s) + margin, H = Math.ceil((y1 + 1 - oy) / s) + margin;
  const px = new Array(W * H).fill(null);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0; const votes = {};
    for (let yy = Math.floor(oy + Y * s); yy < Math.floor(oy + (Y + 1) * s); yy++) for (let xx = Math.floor(ox + X * s); xx < Math.floor(ox + (X + 1) * s); xx++) {
      n++; if (xx < 0 || yy < 0 || xx >= im.width || yy >= im.height) continue;
      const i = (yy*im.width+xx)*4, al = im.data[i+3]/255; if (!al) continue;
      r += im.data[i]*al; g += im.data[i+1]*al; b += im.data[i+2]*al; a += al;
      if (al > 0.5) { const L = label(xx, yy, im.data[i], im.data[i+1], im.data[i+2]); votes[L] = (votes[L] || 0) + 1; }
    }
    if (!n || a / n < 0.45) continue;
    const L = Object.entries(votes).sort((p, q) => q[1] - p[1])[0]?.[0] ?? "body";
    px[Y * W + X] = { r: r/a, g: g/a, b: b/a, label: L };
  }
  return { W, H, s, ox, oy, px, toLow: (x, y) => [(x - ox) / s, (y - oy) / s] };
}
/** Fill transparent pixels of `layer` (Map idx->rgb) at idxs by averaging filled neighbours, repeatedly. */
export function inpaint(W, H, layer, idxs) {
  let todo = idxs.filter((i) => !layer[i]);
  for (let pass = 0; pass < 50 && todo.length; pass++) {
    const next = []; const fills = [];
    for (const i of todo) { const x = i % W, y = (i / W) | 0; let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const q = layer[(y+dy)*W + x+dx]; if (x+dx>=0 && x+dx<W && q) { r += q.r; g += q.g; b += q.b; n++; } }
      if (n >= 1) fills.push([i, { r: r/n, g: g/n, b: b/n }]); else next.push(i); }
    for (const [i, c] of fills) layer[i] = c; todo = next;
  }
}
export function writeLayer(f, W, H, layer) {
  const o = new PNG({ width: W, height: H });
  for (let i = 0; i < W * H; i++) { const c = layer[i]; if (!c) continue; o.data[i*4] = Math.round(c.r); o.data[i*4+1] = Math.round(c.g); o.data[i*4+2] = Math.round(c.b); o.data[i*4+3] = 255; }
  fs.writeFileSync(f, PNG.sync.write(o));
}
/** Remove 8-connected components smaller than `min` pixels from a layer. */
export function dropSpecks(W, H, layer, min) {
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { if (!layer[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    for (let k = 0; k < comp.length; k++) { const x = comp[k] % W, y = (comp[k] / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && layer[j] && !seen[j]) { seen[j] = 1; comp.push(j); } } }
    if (comp.length < min) for (const j of comp) delete layer[j]; }
}
