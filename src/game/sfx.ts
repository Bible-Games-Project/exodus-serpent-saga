// Tiny WebAudio sound bank. Sounds are synthesised on the fly (no assets), so a
// hit never waits on a download. Respects the game's sound settings.
import { loadSettings } from "@/hooks/useSettings";

let ctxRef: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctxRef) ctxRef = new Ctor();
  if (ctxRef.state === "suspended") void ctxRef.resume();
  return ctxRef;
}

function gainLevel(): number {
  const s = loadSettings();
  if (!s.volume) return 0;
  return Math.max(0, Math.min(1, s.volumeLevel / 100));
}

let noiseBuf: AudioBuffer | null = null;
function noise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** One short metallic clank. Three variants, chosen at random by the caller. */
function metalHit(variant: number, master: number): void {
  const ac = audio();
  if (!ac || master <= 0) return;
  const t = ac.currentTime;
  const V = [
    { tone: 2100, ring: 3400, dur: 0.16, bright: 5200 },
    { tone: 1650, ring: 2600, dur: 0.22, bright: 4200 },
    { tone: 2600, ring: 4300, dur: 0.13, bright: 6400 },
  ][variant % 3];

  const out = ac.createGain();
  out.gain.value = 0.35 * master;
  out.connect(ac.destination);

  // transient: filtered noise burst = staff wood striking metal
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = V.bright;
  bp.Q.value = 1.1;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.9, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(bp).connect(ng).connect(out);
  src.start(t);
  src.stop(t + 0.08);

  // two inharmonic partials = the shield's metallic ring
  for (const [f, a] of [[V.tone, 0.5], [V.ring, 0.28]] as const) {
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.86, t + V.dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + V.dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + V.dur + 0.02);
  }
}

let lastShieldSound = 0;
/** Random one of three metal impacts; de-duplicated per impact. */
export function playShieldBlock(): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastShieldSound < 60) return;
  lastShieldSound = now;
  metalHit(Math.floor(Math.random() * 3), gainLevel());
}
