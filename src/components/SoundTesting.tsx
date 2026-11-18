// Test Map → Sound testing: listen to the five generated alternatives of every
// sound event and choose one. Choices are saved in this browser and used by the
// game right away; "Copy choices" gives the text that makes them permanent.
import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { previewSound, stopPreview } from "@/game/audio/audioManager";
import { ALTERNATIVES, SOUND_CATEGORIES, SOUND_EVENTS, soundPath, type SoundCategory } from "@/game/audio/soundCatalog";
import { CHOICES_EVENT, allChoices, chooseAlternative } from "@/game/audio/soundChoices";

function useChoices(): Record<string, number> {
  const [choices, setChoices] = useState<Record<string, number>>({});
  useEffect(() => {
    const read = () => setChoices(allChoices());
    read();
    window.addEventListener(CHOICES_EVENT, read);
    return () => window.removeEventListener(CHOICES_EVENT, read);
  }, []);
  return choices;
}

/** Files that exist, from public/audio/manifest.json (null while loading). */
function useAvailable(): Set<string> | null {
  const [files, setFiles] = useState<Set<string> | null>(null);
  useEffect(() => {
    const base = import.meta.env.BASE_URL ?? "/";
    fetch(`${base}audio/manifest.json`)
      .then((r) => r.json())
      .then((m: { events: Array<{ files: string[]; missing?: string[] }> }) => {
        const s = new Set<string>();
        for (const ev of m.events) for (const f of ev.files) if (!ev.missing?.includes(f)) s.add(f);
        setFiles(s);
      })
      .catch(() => setFiles(new Set(SOUND_EVENTS.flatMap((ev) => Array.from({ length: ALTERNATIVES }, (_, i) => soundPath(ev, i + 1))))));
  }, []);
  return files;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[11px] uppercase tracking-wider">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        data-sfx="none"
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full appearance-none border-[3px] border-[#3a2412] bg-[#f6e2ad] accent-[#b5731f]"
      />
    </label>
  );
}

export function SoundTesting() {
  const [settings, update] = useSettings();
  const choices = useChoices();
  const available = useAvailable();
  const [cat, setCat] = useState<SoundCategory>(SOUND_CATEGORIES[0].id);
  const [playing, setPlaying] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const events = useMemo(() => SOUND_EVENTS.filter((ev) => ev.category === cat), [cat]);
  const chosenCount = SOUND_EVENTS.filter((ev) => choices[ev.id] != null).length;

  useEffect(() => () => stopPreview(), []);

  const play = async (id: string, n: number) => {
    const key = `${id}#${n}`;
    setPlaying(key);
    const ok = await previewSound(id, n);
    if (!ok) setPlaying(null);
    else window.setTimeout(() => setPlaying((p) => (p === key ? null : p)), 1500);
  };

  const copy = async () => {
    const sorted = Object.fromEntries(Object.entries(choices).sort(([a], [b]) => a.localeCompare(b)));
    const text = JSON.stringify(sorted, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied. Paste it in the chat to make these choices permanent for every player.");
    } catch {
      setCopied(text);
    }
  };

  return (
    <section className="pixel-panel mb-6 bg-[#f6e2ad] p-5 font-pixel text-[#4a2f16]" aria-label="Sound testing">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base uppercase tracking-[0.14em]">Sound testing</h2>
        <span className="text-xs uppercase tracking-wider">
          Chosen <b className="tabular-nums">{chosenCount}</b> / {SOUND_EVENTS.length}
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed">
        Each sound has {ALTERNATIVES} options. Press PLAY to listen and SELECT to use one in the game. Your choices are
        saved in this browser and play in the game straight away. A sound with no option selected stays silent.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Slider label="Preview volume" value={settings.previewVolume} onChange={(v) => update({ previewVolume: v })} />
        <Slider label="Sound effects" value={settings.sfxVolume} onChange={(v) => update({ sfxVolume: v })} />
        <Slider label="Master" value={settings.volumeLevel} onChange={(v) => update({ volumeLevel: v })} />
        <button
          data-sfx="none"
          onClick={() => { stopPreview(); setPlaying(null); }}
          className="pixel-btn pixel-btn-press font-display bg-[#e9c168] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#3a2412]"
        >
          Stop preview
        </button>
        <button
          onClick={copy}
          className="pixel-btn pixel-btn-press font-display bg-[#e9c168] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#3a2412]"
        >
          Copy choices
        </button>
      </div>
      {!settings.volume && (
        <p className="mb-3 border-2 border-[#a5452a] bg-[#f3c9a8] p-2 text-xs">Sound is off in Settings: turn it on to hear the game sounds.</p>
      )}
      {copied && (
        <pre className="mb-3 max-h-40 overflow-auto whitespace-pre-wrap border-2 border-[#3a2412] bg-[#fff6d8] p-2 text-[10px]">{copied}</pre>
      )}

      <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
        {SOUND_CATEGORIES.map((c) => {
          const evs = SOUND_EVENTS.filter((ev) => ev.category === c.id);
          const done = evs.filter((ev) => choices[ev.id] != null).length;
          const active = c.id === cat;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => setCat(c.id)}
              className={`border-[3px] border-[#3a2412] px-2.5 py-1 text-[10px] uppercase tracking-wider ${active ? "bg-[#b5731f] text-[#fff3d0]" : "bg-[#fbe9bd]"}`}
            >
              {c.label} <span className="tabular-nums opacity-80">{done}/{evs.length}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {events.map((ev) => {
          const sel = choices[ev.id];
          return (
            <div key={ev.id} className={`border-[3px] p-3 ${sel ? "border-[#3a2412] bg-[#fbe9bd]" : "border-dashed border-[#8a6a3a] bg-[#f6e2ad]"}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-sm font-bold">{ev.label}</div>
                  <div className="text-[10px] opacity-70">{ev.id}</div>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                  {sel ? <span className="bg-[#3f7a2e] px-2 py-0.5 text-[#f4ffe6]">Option {sel} selected</span> : <span className="opacity-70">Nothing selected (silent)</span>}
                  {sel && (
                    <button data-sfx="none" onClick={() => chooseAlternative(ev.id, null)} className="underline">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-5">
                {Array.from({ length: ALTERNATIVES }, (_, i) => i + 1).map((n) => {
                  const exists = !available || available.has(soundPath(ev, n));
                  const isSel = sel === n;
                  const isPlaying = playing === `${ev.id}#${n}`;
                  return (
                    <div
                      key={n}
                      className={`flex items-center justify-between gap-1 border-[3px] px-2 py-1.5 sm:flex-col sm:items-stretch ${
                        isSel ? "border-[#d9a520] bg-[#ffe9a0] shadow-[0_0_0_2px_#3a2412]" : "border-[#3a2412] bg-[#fff6d8]"
                      } ${exists ? "" : "opacity-50"}`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider sm:text-center">
                        {isSel ? "★ " : ""}Option {n}
                      </span>
                      {exists ? (
                        <div className="flex gap-1">
                          <button
                            data-sfx="none"
                            onClick={() => void play(ev.id, n)}
                            className={`flex-1 border-2 border-[#3a2412] px-2 py-1 text-[10px] uppercase ${isPlaying ? "bg-[#b5731f] text-[#fff3d0]" : "bg-[#e9c168]"}`}
                          >
                            {isPlaying ? "♪ Play" : "▶ Play"}
                          </button>
                          <button
                            data-sfx="none"
                            onClick={() => chooseAlternative(ev.id, n)}
                            disabled={isSel}
                            className={`flex-1 border-2 border-[#3a2412] px-2 py-1 text-[10px] uppercase ${isSel ? "bg-[#3f7a2e] text-[#f4ffe6]" : "bg-[#fbe9bd]"}`}
                          >
                            {isSel ? "Selected" : "Select"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] italic sm:text-center">Not generated yet</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
