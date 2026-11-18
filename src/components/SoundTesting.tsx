// Test Map → Sound testing: every game action in a list (several columns),
// each with a dropdown to assign any sound of the library. Several actions may
// share a sound. Green = assigned by you, amber = the game's default pick,
// grey = silent. Picks are saved in this browser and used by the game at once;
// "Copy choices" gives the text that makes them permanent for every player.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "@/hooks/useSettings";
import { previewSound, stopPreview } from "@/game/audio/audioManager";
import { SOUND_ACTIONS, SOUND_CATEGORIES, type SoundEvent } from "@/game/audio/soundCatalog";
import { CHOICES_EVENT, allAssignments, assignSound, assignmentSource, myAssignments } from "@/game/audio/soundChoices";
import { LIBRARY_BY_PATH, LIBRARY_GROUPS, SOUND_LIBRARY } from "@/game/audio/soundLibrary";

function useAssignmentsVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((x) => x + 1);
    window.addEventListener(CHOICES_EVENT, bump);
    return () => window.removeEventListener(CHOICES_EVENT, bump);
  }, []);
  return v;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-[11px] uppercase tracking-wider">
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

const btn = "pixel-btn pixel-btn-press font-display bg-[#e9c168] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#3a2412]";

/** Dropdown list of the whole library, opened under (or above) its button. */
function SoundPicker({ action, anchor, onClose }: { action: SoundEvent; anchor: HTMLElement; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number }>({ left: 0, top: 0, maxH: 300 });
  const panel = useRef<HTMLDivElement>(null);
  const current = allAssignments()[action.id] ?? "";
  const source = assignmentSource(action.id);

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const W = 320;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const useBelow = below >= 260 || below >= above;
    const maxH = Math.min(440, useBelow ? below : above);
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)), top: useBelow ? r.bottom + 4 : r.top - 4 - maxH, maxH });
  }, [anchor]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (panel.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const scroll = () => onClose();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll);
    };
  }, [anchor, onClose]);

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      LIBRARY_GROUPS.map((g) => ({
        g,
        items: SOUND_LIBRARY.filter((s) => s.group === g && (!q || s.name.toLowerCase().includes(q) || g.toLowerCase().includes(q))),
      })).filter((x) => x.items.length),
    [q],
  );

  const pick = (path: string | undefined) => {
    assignSound(action.id, path);
    if (path) void previewSound(path, action.id);
    onClose();
  };

  return createPortal(
    <div
      ref={panel}
      className="font-pixel fixed z-[100] flex w-[320px] flex-col border-[3px] border-[#3a2412] bg-[#fff6d8] text-[#4a2f16] shadow-[0_6px_0_0_rgba(58,36,18,0.6)]"
      style={{ left: pos.left, top: pos.top, height: pos.maxH }}
    >
      <div className="border-b-2 border-[#3a2412] p-2">
        <input
          autoFocus={window.matchMedia("(pointer: fine)").matches}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search (coin, hit, chime…)"
          className="w-full border-2 border-[#3a2412] bg-white px-2 py-1 text-xs"
        />
        <div className="mt-1.5 flex gap-1.5">
          <button data-sfx="none" onClick={() => pick("")} className="flex-1 border-2 border-[#3a2412] bg-[#e8dcc0] px-1 py-0.5 text-[10px] uppercase">
            Silent
          </button>
          {source === "you" && (
            <button data-sfx="none" onClick={() => pick(undefined)} className="flex-1 border-2 border-[#3a2412] bg-[#f3d58a] px-1 py-0.5 text-[10px] uppercase">
              Back to default
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map(({ g, items }) => (
          <div key={g}>
            <div className="sticky top-0 bg-[#e9c168] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{g}</div>
            {items.map((s) => (
              <div key={s.path} className={`flex items-center gap-1 px-1 ${s.path === current ? "bg-[#cfe8b8]" : "hover:bg-[#fbe9bd]"}`}>
                <button
                  data-sfx="none"
                  aria-label={`Play ${s.name}`}
                  onClick={() => void previewSound(s.path, action.id)}
                  className="shrink-0 px-1.5 py-1 text-xs"
                >
                  ▶
                </button>
                <button data-sfx="none" onClick={() => pick(s.path)} className="min-w-0 flex-1 truncate py-1 text-left text-xs">
                  {s.path === current ? "✓ " : ""}
                  {s.name}
                </button>
              </div>
            ))}
          </div>
        ))}
        {!groups.length && <p className="p-3 text-xs italic">No sound matches.</p>}
      </div>
    </div>,
    document.body,
  );
}

function ActionRow({ action, open, onOpen, onClose }: { action: SoundEvent; open: boolean; onOpen: (el: HTMLElement) => void; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const path = allAssignments()[action.id] ?? "";
  const source = assignmentSource(action.id);
  const sound = path ? LIBRARY_BY_PATH[path] : undefined;
  const tone =
    source === "you" && path
      ? "border-[#2f6b22] bg-[#bfe3a6]"
      : source === "default"
        ? "border-[#9a6a1a] bg-[#f6dc9a]"
        : "border-dashed border-[#8a6a3a] bg-[#efe6d2]";
  return (
    <div className="mb-1.5 break-inside-avoid">
      <div className="mb-0.5 text-[11px] font-bold leading-tight">{action.label}</div>
      <div className="flex gap-1">
        <button
          ref={ref}
          data-sfx="none"
          onClick={() => (open ? onClose() : ref.current && onOpen(ref.current))}
          className={`flex min-w-0 flex-1 items-center justify-between gap-1 border-2 px-2 py-1 text-left text-[11px] ${tone}`}
          title={sound ? `${sound.name} — ${sound.group}` : "Silent"}
        >
          <span className="truncate">{sound ? sound.name : path ? "Missing file" : "Silent"}</span>
          <span className="shrink-0 text-[9px] uppercase opacity-70">{source === "you" ? (path ? "yours" : "silent") : source === "default" ? "default" : ""} ▾</span>
        </button>
        <button
          data-sfx="none"
          disabled={!path}
          aria-label={`Play ${action.label}`}
          onClick={() => path && void previewSound(path, action.id)}
          className="shrink-0 border-2 border-[#3a2412] bg-[#e9c168] px-2 text-xs disabled:opacity-40"
        >
          ▶
        </button>
      </div>
    </div>
  );
}

export function SoundTesting() {
  const [settings, update] = useSettings();
  useAssignmentsVersion();
  const [openId, setOpenId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => () => stopPreview(), []);

  const mine = myAssignments();
  const all = allAssignments();
  const yours = SOUND_ACTIONS.filter((a) => a.id in mine && all[a.id]).length;
  const defaults = SOUND_ACTIONS.filter((a) => !(a.id in mine) && all[a.id]).length;
  const silent = SOUND_ACTIONS.filter((a) => !all[a.id]).length;
  const openAction = SOUND_ACTIONS.find((a) => a.id === openId);

  const copy = async () => {
    const sorted = Object.fromEntries(Object.entries(mine).sort(([a], [b]) => a.localeCompare(b)));
    const text = JSON.stringify(sorted, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied. Paste it in the chat to make these choices permanent for every player.");
    } catch {
      setCopied(text);
    }
  };

  return (
    <section className="pixel-panel mb-6 bg-[#f6e2ad] p-4 font-pixel text-[#4a2f16] sm:p-5" aria-label="Sound testing">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base uppercase tracking-[0.14em]">Sound testing</h2>
        <span className="flex flex-wrap gap-3 text-[11px] uppercase tracking-wider">
          <span><span className="inline-block h-2.5 w-2.5 border border-[#2f6b22] bg-[#bfe3a6]" /> Yours <b className="tabular-nums">{yours}</b></span>
          <span><span className="inline-block h-2.5 w-2.5 border border-[#9a6a1a] bg-[#f6dc9a]" /> Default <b className="tabular-nums">{defaults}</b></span>
          <span><span className="inline-block h-2.5 w-2.5 border border-dashed border-[#8a6a3a] bg-[#efe6d2]" /> Silent <b className="tabular-nums">{silent}</b></span>
          <span>Library <b className="tabular-nums">{SOUND_LIBRARY.length}</b></span>
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed">
        Open the dropdown of an action to pick any sound of the library (▶ listens, the name assigns it). Several actions
        can share one sound. Your picks turn green, are saved in this browser and play in the game straight away.
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Slider label="Preview volume" value={settings.previewVolume} onChange={(v) => update({ previewVolume: v })} />
        <Slider label="Sound effects" value={settings.sfxVolume} onChange={(v) => update({ sfxVolume: v })} />
        <Slider label="Master" value={settings.volumeLevel} onChange={(v) => update({ volumeLevel: v })} />
        <button data-sfx="none" onClick={() => stopPreview()} className={btn}>
          Stop preview
        </button>
        <button onClick={copy} className={btn}>
          Copy choices
        </button>
      </div>
      {!settings.volume && (
        <p className="mb-3 border-2 border-[#a5452a] bg-[#f3c9a8] p-2 text-xs">Sound is off in Settings: turn it on to hear the game sounds.</p>
      )}
      {copied && (
        <pre className="mb-3 max-h-40 overflow-auto whitespace-pre-wrap border-2 border-[#3a2412] bg-[#fff6d8] p-2 text-[10px]">{copied}</pre>
      )}

      <div className="gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {SOUND_CATEGORIES.map((c) => (
          <div key={c.id} className="mb-3 break-inside-avoid-column">
            <h3 className="mb-1.5 border-b-2 border-[#3a2412] pb-0.5 text-xs font-bold uppercase tracking-wider">{c.label}</h3>
            {SOUND_ACTIONS.filter((a) => a.category === c.id).map((a) => (
              <ActionRow
                key={a.id}
                action={a}
                open={openId === a.id}
                onOpen={(el) => { setAnchor(el); setOpenId(a.id); }}
                onClose={() => setOpenId(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {openAction && anchor && <SoundPicker action={openAction} anchor={anchor} onClose={() => setOpenId(null)} />}
    </section>
  );
}
