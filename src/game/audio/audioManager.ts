// Central audio manager. Every game / UI sound goes through `sfx(id)`.
//
// - Sounds are the five generated alternatives per event in public/audio/
//   (see soundCatalog.ts). Gameplay only plays the alternative the player
//   chose in Test Map → Sound testing; an event with no choice stays silent.
// - Buses: master → { sfx, music, preview }. Volumes come from the settings.
// - Overload control: global voice cap with priority stealing, a per-event
//   (or per-group) voice cap and a per-event cooldown, so 20 enemies dying in
//   one frame play at most a few sounds.
// - Small random pitch / volume variation per play.
// - Buffers load lazily and are cached; selected sounds are preloaded when a
//   run starts so the first hit never waits on a download.
import { SETTINGS_EVENT, loadSettings, type Settings } from "@/hooks/useSettings";
import { SOUND_BY_ID, soundUrl, type SoundEvent } from "./soundCatalog";
import { chosenAlternative } from "./soundChoices";

const MAX_VOICES = 24;

let ac: AudioContext | null = null;
let masterBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let previewBus: GainNode | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ac) {
    ac = new Ctor();
    masterBus = ac.createGain();
    masterBus.connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.connect(masterBus);
    musicBus = ac.createGain();
    musicBus.connect(masterBus);
    previewBus = ac.createGain();
    previewBus.connect(masterBus);
    applyVolumes();
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

/** Shared context for the few synthesised sounds (sfx.ts). */
export function audioContext(): AudioContext | null {
  return context();
}
/** Bus the synthesised sounds connect to (respects the SFX volume). */
export function sfxOutput(): AudioNode | null {
  context();
  return sfxBus;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function applyVolumes(s: Settings = settings()) {
  if (!ac || !masterBus || !sfxBus || !musicBus || !previewBus) return;
  const t = ac.currentTime;
  masterBus.gain.setTargetAtTime(s.volume ? clamp01(s.volumeLevel / 100) : 0, t, 0.02);
  sfxBus.gain.setTargetAtTime(clamp01(s.sfxVolume / 100), t, 0.02);
  musicBus.gain.setTargetAtTime(clamp01(s.musicVolume / 100), t, 0.02);
  previewBus.gain.setTargetAtTime(clamp01(s.previewVolume / 100), t, 0.02);
}

// Settings are cached (sfx() can be called many times per frame) and refreshed on change.
let settingsCache: Settings | null = null;
function settings(): Settings {
  return (settingsCache ??= loadSettings());
}
if (typeof window !== "undefined") window.addEventListener(SETTINGS_EVENT, () => { settingsCache = null; applyVolumes(); });

// ---------- buffers ----------
const buffers = new Map<string, AudioBuffer | null>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

function loadBuffer(url: string): Promise<AudioBuffer | null> {
  const ready = buffers.get(url);
  if (ready !== undefined) return Promise.resolve(ready);
  let p = loading.get(url);
  if (!p) {
    const c = context();
    if (!c) return Promise.resolve(null);
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .catch(() => null)
      .then((buf) => {
        buffers.set(url, buf);
        loading.delete(url);
        return buf;
      });
    loading.set(url, p);
  }
  return p;
}

/** Preload the chosen alternative of every event (call when a run starts). */
export function preloadChosenSounds() {
  if (!context()) return;
  for (const ev of Object.values(SOUND_BY_ID)) {
    const n = chosenAlternative(ev.id);
    if (n != null) void loadBuffer(soundUrl(ev, n));
  }
}

// ---------- voices ----------
type Voice = { key: string; priority: number; src: AudioBufferSourceNode; started: number };
const voices: Voice[] = [];
const lastPlayed = new Map<string, number>();
const streaks = new Map<string, number>();

function dropVoice(v: Voice) {
  const i = voices.indexOf(v);
  if (i >= 0) voices.splice(i, 1);
}

export type SfxOptions = {
  /** extra volume factor (0-1+) */
  volume?: number;
  /** fixed pitch factor on top of the random variation */
  pitch?: number;
  /** start this many seconds from now */
  delay?: number;
};

/**
 * Play a game / UI sound event. Silently does nothing when sound is off, the
 * event has no chosen alternative, it is on cooldown, or too many sounds of
 * its kind (or of higher priority) are already playing.
 */
export function sfx(id: string, opts: SfxOptions = {}) {
  const ev = SOUND_BY_ID[id];
  if (!ev) return;
  const n = chosenAlternative(id);
  if (n == null) return;
  const s = settings();
  if (!s.volume || s.volumeLevel <= 0 || s.sfxVolume <= 0) return;
  const c = context();
  if (!c || !sfxBus) return;
  const now = c.currentTime;
  const key = ev.group ?? ev.id;
  if (now - (lastPlayed.get(key) ?? -1e9) < ev.cooldown) return;
  const url = soundUrl(ev, n);
  const buf = buffers.get(url);
  if (!buf) {
    // Not loaded yet: start loading, skip this one play.
    if (buf === undefined) void loadBuffer(url);
    return;
  }
  // Per-event / per-group cap.
  const same = voices.filter((v) => v.key === key);
  if (same.length >= ev.maxVoices) {
    if (!ev.restart) return;
    stopVoice(same[0]);
  }
  // Global cap with priority stealing (1 = most important).
  if (voices.length >= MAX_VOICES) {
    let worst: Voice | null = null;
    for (const v of voices) if (!worst || v.priority > worst.priority || (v.priority === worst.priority && v.started < worst.started)) worst = v;
    if (!worst || worst.priority < ev.priority) return;
    stopVoice(worst);
  }
  // Pickup streaks: quick consecutive plays climb in pitch (up to +35%).
  let pitch = opts.pitch ?? 1;
  if (ev.streak) {
    const st = now - (lastPlayed.get(key) ?? -1e9) < 0.5 ? Math.min(12, (streaks.get(key) ?? 0) + 1) : 0;
    streaks.set(key, st);
    pitch *= 1 + st * 0.03;
  }
  lastPlayed.set(key, now);
  startVoice(c, sfxBus, buf, ev, key, { ...opts, pitch });
}

function startVoice(c: AudioContext, bus: AudioNode, buf: AudioBuffer, ev: SoundEvent, key: string, opts: SfxOptions) {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * ev.pitchVar);
  const g = c.createGain();
  g.gain.value = ev.volume * (opts.volume ?? 1) * (1 - Math.random() * 0.08);
  src.connect(g).connect(bus);
  const v: Voice = { key, priority: ev.priority, src, started: c.currentTime };
  voices.push(v);
  src.onended = () => dropVoice(v);
  src.start(c.currentTime + Math.max(0, opts.delay ?? 0));
}

function stopVoice(v: Voice) {
  try { v.src.stop(); } catch { /* already stopped */ }
  dropVoice(v);
}

// ---------- preview (Sound testing menu) ----------
let previewSrc: AudioBufferSourceNode | null = null;

export function stopPreview() {
  if (previewSrc) {
    try { previewSrc.stop(); } catch { /* ended */ }
    previewSrc = null;
  }
}

/** Play alternative `n` (1-5) of an event on the preview bus. Resolves false if the file is missing. */
export async function previewSound(id: string, n: number): Promise<boolean> {
  const ev = SOUND_BY_ID[id];
  const c = context();
  if (!ev || !c || !previewBus) return false;
  stopPreview();
  const buf = await loadBuffer(soundUrl(ev, n));
  if (!buf) return false;
  stopPreview();
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = ev.volume;
  src.connect(g).connect(previewBus);
  src.onended = () => { if (previewSrc === src) previewSrc = null; };
  previewSrc = src;
  src.start();
  return true;
}

// ---------- music ----------
// No music tracks yet: the bus and volume are ready for when they are chosen.
let musicSrc: { el: HTMLAudioElement; node: MediaElementAudioSourceNode } | null = null;

export function playMusic(url: string | null) {
  const c = context();
  if (musicSrc) {
    musicSrc.el.pause();
    musicSrc.node.disconnect();
    musicSrc = null;
  }
  if (!c || !musicBus || !url) return;
  const el = new Audio(url);
  el.loop = true;
  const node = c.createMediaElementSource(el);
  node.connect(musicBus);
  musicSrc = { el, node };
  void el.play().catch(() => {});
}
