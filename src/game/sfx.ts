// Synthesised fallback sounds (no assets). The shield clank plays only while
// no generated alternative has been chosen for "weapon.shield.block" in
// Test Map → Sound testing. Goes through the audio manager's SFX bus, so the
// master and SFX volumes apply.
import { audioContext, sfxOutput } from "./audio/audioManager";

function audio(): AudioContext | null {
  return audioContext();
}

function gainLevel(): number {
  return 1;
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
  out.connect(sfxOutput() ?? ac.destination);

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
