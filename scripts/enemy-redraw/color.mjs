export function rgb2hsl(r, g, b) { r/=255; g/=255; b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b); let h=0, s=0; const l=(mx+mn)/2;
  if (mx!==mn) { const d=mx-mn; s = l>0.5 ? d/(2-mx-mn) : d/(mx+mn); h = mx===r ? (g-b)/d + (g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; h*=60; } return [h,s,l]; }
export function hsl2rgb(h, s, l) { h=((h%360)+360)%360/360; const f=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
  if (!s) return [l*255,l*255,l*255]; const q = l<0.5 ? l*(1+s) : l+s-l*s, p=2*l-q; return [f(p,q,h+1/3)*255, f(p,q,h)*255, f(p,q,h-1/3)*255]; }
export const isSkin = ([h, s, l]) => h >= 8 && h <= 38 && s > 0.25 && l > 0.25 && l < 0.8;
