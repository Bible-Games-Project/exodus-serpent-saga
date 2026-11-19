// Level-up plague progress: the painted plagues bar (serpent attack and leprous
// hand stacked at the left, the ten plagues, then the Pillar of Cloud and the
// Pillar of Fire stacked before the Red Sea) with the attacks already
// sent shown lit, the latest one ringed in gold with a marker beside it, the
// next one (when this level up offers to unlock it) glowing, and the ones still
// to come faded. The Red Sea end of the bar lights up once the Red Sea miracle
// is unlocked.
import plaguesBar from "@/assets/ui-plagues-bar.png";
import { PLAGUE_ORDER } from "./plagues";
import type { GameState, PlagueId, UpgradeChoice } from "./types";

/** The attacks with a slot on the bar, in slot order. */
export const PLAGUE_BAR_ORDER: PlagueId[] = ["serpent", "leprosy", "blood", "frogs", "gnats", "flies", "livestock", "boils", "hail", "locusts", "darkness", "firstborn", "cloudpillar", "firepillar"];
const TEN_PLAGUES = PLAGUE_BAR_ORDER.slice(2, 12);

// Slot geometry measured on the 1200x234 bar image: centre x/y and size of each
// slot, and on which side the "latest" marker sits (the stacked slots cannot
// all have it above). The stacked slots are rounded squares, the plagues
// tall octagons.
type Marker = "top" | "left" | "right";
const BAR_W = 1200;
const BAR_H = 234;
const SQUARE_SLOT = { w: 82, h: 66, square: true };
const PLAGUE_SLOT = { w: 78, h: 104, square: false, marker: "top" as Marker };
const SLOTS: Array<{ x: number; y: number; w: number; h: number; square: boolean; marker: Marker }> = [
  { x: 82, y: 84, ...SQUARE_SLOT, marker: "top" },
  { x: 82, y: 154, ...SQUARE_SLOT, marker: "left" },
  ...[175, 259, 343, 428, 513, 598, 682, 767, 851, 935].map((x) => ({ x, y: 133, ...PLAGUE_SLOT })),
  { x: 1013, y: 83, ...SQUARE_SLOT, w: 74, marker: "top" },
  { x: 1013, y: 154, ...SQUARE_SLOT, w: 74, marker: "right" },
];
// Red Sea vignette at the right end (waves + staff).
const SEA = { x: 1052, y: 1, w: 147, h: 232 };

const OCTAGON = "polygon(24% 0, 76% 0, 100% 20%, 100% 80%, 76% 100%, 24% 100%, 0 80%, 0 20%)";
const ROUNDED = "inset(0 round 28%)";
const MARKER_BOUNCE = "exodus-new-bounce 0.9s ease-in-out infinite";
const MARKER_STYLE: Record<Marker, { className: string; style: Record<string, string> }> = {
  top: { className: "absolute left-1/2 -translate-x-1/2", style: { top: "-38%", width: "46%" } },
  left: { className: "absolute -translate-y-1/2", style: { left: "-40%", top: "50%", width: "40%", rotate: "-90deg" } },
  right: { className: "absolute -translate-y-1/2", style: { right: "-40%", top: "50%", width: "40%", rotate: "90deg" } },
};
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function PlagueBar({ state, choices }: { state: GameState; choices: UpgradeChoice[] }) {
  const owned = PLAGUE_BAR_ORDER.map((id) => state.plagues.has(id));
  // The latest unlock in game order (the Red Sea has no slot, so then none is marked).
  const latest = [...PLAGUE_ORDER].reverse().find((id) => id !== "staff" && state.plagues.has(id));
  const current = latest ? PLAGUE_BAR_ORDER.indexOf(latest) : -1;
  const offered = choices.find((c) => c.isUnlock && c.plague && PLAGUE_BAR_ORDER.includes(c.plague))?.plague;
  const next = offered ? PLAGUE_BAR_ORDER.indexOf(offered) : -1;
  const seaOn = state.plagues.has("redsea");
  const sent = TEN_PLAGUES.filter((id) => state.plagues.has(id)).length;
  return (
    <div
      className="relative mx-auto mb-2 shrink-0 sm:mb-3"
      style={{ width: `min(100%, calc(clamp(44px, 10vh, 96px) * ${BAR_W / BAR_H}))`, aspectRatio: `${BAR_W} / ${BAR_H}` }}
      title={`Plagues sent: ${sent} of 10`}
    >
      <img src={plaguesBar} alt="Serpent, leprosy, the ten plagues, the pillars of cloud and fire and the Red Sea" draggable={false} className="absolute inset-0 h-full w-full select-none" />
      {SLOTS.map((s, i) => {
        const box = { left: pct(s.x - s.w / 2, BAR_W), top: pct(s.y - s.h / 2, BAR_H), width: pct(s.w, BAR_W), height: pct(s.h, BAR_H) };
        const clip = s.square ? ROUNDED : OCTAGON;
        if (i === current) {
          return (
            <span key={i} className="pointer-events-none absolute" style={box}>
              <span className="absolute inset-0" style={{ clipPath: clip, background: "radial-gradient(circle, rgba(255,236,150,0.55) 30%, rgba(255,196,60,0.85) 72%, rgba(200,120,20,0.95) 100%)", mixBlendMode: "multiply", animation: "exodus-plague-glow 1.4s ease-in-out infinite" }} />
              <span className={MARKER_STYLE[s.marker].className} style={{ ...MARKER_STYLE[s.marker].style, animation: MARKER_BOUNCE }}>
                <svg viewBox="0 0 12 10" className="block w-full" aria-hidden>
                  <path d="M0 0h12L6 10z" fill="#3a2412" />
                  <path d="M2.2 1.3h7.6L6 7.6z" fill="#ffd34d" />
                </svg>
              </span>
            </span>
          );
        }
        if (owned[i]) {
          return <span key={i} className="pointer-events-none absolute" style={{ ...box, clipPath: clip, background: "rgba(255,214,110,0.35)", mixBlendMode: "multiply" }} />;
        }
        return (
          <span
            key={i}
            className="pointer-events-none absolute"
            style={{ ...box, clipPath: clip, background: i === next ? "rgba(255,240,190,0.25)" : "rgba(250,226,176,0.68)", boxShadow: i === next ? "inset 0 0 0 3px #ffd34d" : undefined, animation: i === next ? "exodus-plague-glow 0.9s ease-in-out infinite" : undefined }}
          />
        );
      })}
      {!seaOn && (
        <span
          className="pointer-events-none absolute"
          style={{
            left: pct(SEA.x, BAR_W), top: pct(SEA.y, BAR_H), width: pct(SEA.w, BAR_W), height: pct(SEA.h, BAR_H),
            // A faded, desaturated copy of the same part of the bar on top of it.
            backgroundImage: `url(${plaguesBar})`,
            backgroundSize: `${(BAR_W / SEA.w) * 100}% ${(BAR_H / SEA.h) * 100}%`,
            backgroundPosition: `${(SEA.x / (BAR_W - SEA.w)) * 100}% ${(SEA.y / (BAR_H - SEA.h)) * 100}%`,
            filter: "saturate(0.12) brightness(1.12)",
            maskImage: "linear-gradient(to right, transparent 0, #000 14%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 14%)",
          }}
        />
      )}
    </div>
  );
}
