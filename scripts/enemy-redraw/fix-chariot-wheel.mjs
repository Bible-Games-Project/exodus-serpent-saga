// Trims the chariot wheel layer to its rim and clears the body's copy of the
// wheel below the cab (spoke stubs, gold rim bits, pin-holes), so only one
// wheel turns. Writes chariot-v4-wheel.png and chariot-v4-body.png.
// (A later pass also erased faint hind-leg outline remnants beside the tail.)
import fs from "fs"; import { PNG } from "pngjs";
const A = new URL("../../src/assets/", import.meta.url).pathname;
const w = PNG.sync.read(fs.readFileSync(A+"chariot-v3-wheel.png"));
for (let y=0;y<w.height;y++) for (let x=0;x<w.width;x++){ if (Math.hypot(x+0.5-160,y+0.5-160)>151) w.data[(y*w.width+x)*4+3]=0; }
fs.writeFileSync(A+"chariot-v4-wheel.png", PNG.sync.write(w));
const b = PNG.sync.read(fs.readFileSync(A+"chariot-v3-body.png"));
const HX=343, HY=814; const W=b.width;
const gold=(i)=>{const r=b.data[i],g=b.data[i+1],bl=b.data[i+2]; return r>150&&g>105&&bl<120&&r-bl>70;};
const orig=Buffer.from(b.data); let erased=0, painted=0;
for (let y=HY-151;y<=HY+151;y++) for (let x=HX-151;x<=HX+151;x++){ const r=Math.hypot(x+0.5-HX,y+0.5-HY); if (r>=138||r<30) continue; const i=(y*W+x)*4; if (b.data[i+3]===0) continue;
  if (y>872) { b.data[i+3]=0; erased++; continue; }
  const gi=(xx,yy)=>{const j=(yy*W+xx)*4; const r0=orig[j],g0=orig[j+1],b0=orig[j+2]; return r0>150&&g0>105&&b0<120&&r0-b0>70;};
  if (!gi(x,y)) continue;
  // paint with the nearest non-gold pixel along the row
  for (let d=1; d<40; d++) { for (const xx of [x-d,x+d]) { const j=(y*W+xx)*4; if (orig[j+3]>200 && !gi(xx,y)) { for(let q=0;q<4;q++) b.data[i+q]=orig[j+q]; painted++; d=99; break; } } }
}
fs.writeFileSync(A+"chariot-v4-body.png", PNG.sync.write(b)); console.log({erased,painted});
// fill pin-holes in the cab wall behind the wheel (they would flash through the spokes)
const b2 = PNG.sync.read(fs.readFileSync(A+"chariot-v4-body.png")); const o2=Buffer.from(b2.data); let filled=0;
for (let y=HY-151;y<=872;y++) for (let x=HX-151;x<=HX+151;x++){ const r=Math.hypot(x+0.5-HX,y+0.5-HY); if (r>=140) continue; const i=(y*W+x)*4; if (o2[i+3]>200) continue;
  for (let d=1; d<30; d++) { let done=false; for (const [xx,yy] of [[x-d,y],[x+d,y],[x,y-d],[x,y+d]]) { const j=(yy*W+xx)*4; if (o2[j+3]>200 && Math.hypot(xx+0.5-HX,yy+0.5-HY)<140) { for(let q=0;q<4;q++) b2.data[i+q]=o2[j+q]; filled++; done=true; break; } } if (done) break; } }
fs.writeFileSync(A+"chariot-v4-body.png", PNG.sync.write(b2)); console.log({filled});
