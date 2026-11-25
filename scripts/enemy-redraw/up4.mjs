// node up4.mjs in.png out.png — nearest x4, then grow alpha by one sub-pixel so corner-touching pixels stay joined when rotated
import fs from "fs"; import { PNG } from "pngjs";
const im = PNG.sync.read(fs.readFileSync(process.argv[2])); const S = 4; const w = im.width * S, h = im.height * S;
const o = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const si = (Math.floor(y/S) * im.width + Math.floor(x/S)) * 4, di = (y*w+x)*4; for (let c = 0; c < 4; c++) o.data[di+c] = im.data[si+c]; }
const src = Buffer.from(o.data);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const di = (y*w+x)*4; if (src[di+3] >= 128) continue;
  for (const [dx, dy] of [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue; const ni = (ny*w+nx)*4;
    if (src[ni+3] >= 128) { // only bridge diagonal gaps: need an opaque pixel on the opposite diagonal side too
      const ox = x-dx, oy = y-dy; const oi = (oy*w+ox)*4; const opp = ox>=0&&oy>=0&&ox<w&&oy<h && src[oi+3] >= 128;
      const side = (dx && dy) ? [[x+dx,y-dy],[x-dx,y+dy]].some(([sx,sy]) => sx>=0&&sy>=0&&sx<w&&sy<h && src[(sy*w+sx)*4+3]>=128) : false;
      if (opp || side) { for (let c = 0; c < 4; c++) o.data[di+c] = src[ni+c]; break; } } } }
fs.writeFileSync(process.argv[3], PNG.sync.write(o));
