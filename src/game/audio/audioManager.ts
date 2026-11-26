// Central audio manager. Every game / UI sound goes through `sfx(id)`.
//
// - Each event plays the library sound assigned to it (soundChoices.ts:
//   game defaults, overridden in Test Map → Sound testing). Silence at the
//   start of a file is skipped so hits land on the frame they happen.
// - Buses: master → { sfx, music, preview }. Volumes come from the settings.
// - Overload control: global voice cap with priority stealing, a per-event
//   (or per-group) voice cap and a per-event cooldown, so 20 enemies dying in
//   one frame play at most a few sounds.
// - Small random pitch / volume variation per play.
// - Buffers load lazily and are cached; selected sounds are preloaded when a
//   run starts so the first hit never waits on a download.
import { SETTINGS_EVENT, loadSettings, type Settings } from "@/hooks/useSettings";
import { SOUND_ACTIONS, SOUND_BY_ID, libraryUrl, type SoundEvent } from "./soundCatalog";
import { assignedSound } from "./soundChoices";

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
/** seconds of near-silence at the start of each loaded buffer */
const leadIn = new WeakMap<AudioBuffer, number>();

function measureLeadIn(buf: AudioBuffer): number {
  const ch = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const thr = Math.max(0.01, peak * 0.06);
  let i = 0;
  while (i < ch.length && Math.abs(ch[i]) < thr) i++;
  return Math.max(0, i / buf.sampleRate - 0.004);
}
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
        if (buf) leadIn.set(buf, measureLeadIn(buf));
        buffers.set(url, buf);
        loading.delete(url);
        return buf;
      });
    loading.set(url, p);
  }
  return p;
}

/** Preload the assigned sound of every event (call when a run starts). */
export function preloadChosenSounds() {
  if (!context()) return;
  for (const ev of SOUND_ACTIONS) {
    const path = assignedSound(ev.id);
    if (path) void loadBuffer(libraryUrl(path));
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
  const path = assignedSound(id);
  if (!path) return;
  const s = settings();
  if (!s.volume || s.volumeLevel <= 0 || s.sfxVolume <= 0) return;
  const c = context();
  if (!c || !sfxBus) return;
  const now = c.currentTime;
  const key = ev.group ?? ev.id;
  if (now - (lastPlayed.get(key) ?? -1e9) < ev.cooldown) return;
  const url = libraryUrl(path);
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
  src.start(c.currentTime + Math.max(0, opts.delay ?? 0), leadIn.get(buf) ?? 0);
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

/** Play a library sound on the preview bus (at the volume `id` plays in game). Resolves false if it can't load. */
export async function previewSound(path: string, id?: string): Promise<boolean> {
  const ev = id ? SOUND_BY_ID[id] : undefined;
  const c = context();
  if (!c || !previewBus) return false;
  stopPreview();
  const buf = await loadBuffer(libraryUrl(path));
  if (!buf) return false;
  stopPreview();
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = ev?.volume ?? 0.8;
  src.connect(g).connect(previewBus);
  src.onended = () => { if (previewSrc === src) previewSrc = null; };
  previewSrc = src;
  src.start(0, leadIn.get(buf) ?? 0);
  return true;
}

// ---------- music ----------
// One looping track through the music bus (Settings → Music volume).
/** The game's song, looped everywhere (menus and runs). */
export const MAIN_THEME_URL = libraryUrl("audio/Music/the-first-light.mp3");
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

/**
 * Starts the main theme on the first tap / click / key press (browsers block
 * sound before that) and keeps it looping for the whole session.
 */
let musicInstalled = false;
export function installBackgroundMusic() {
  if (musicInstalled || typeof window === "undefined") return;
  musicInstalled = true;
  const start = () => {
    window.removeEventListener("pointerdown", start, true);
    window.removeEventListener("keydown", start, true);
    if (!musicSrc) playMusic(MAIN_THEME_URL);
  };
  window.addEventListener("pointerdown", start, true);
  window.addEventListener("keydown", start, true);
}
