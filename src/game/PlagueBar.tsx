// Level-up plague progress: the painted plagues bar (serpent attack and leprous
// hand stacked at the left, then the ten plagues) with the attacks already
// sent shown lit, the latest one ringed in gold with a marker above it, the
// next one (when this level up offers to unlock it) glowing, and the ones still
// to come faded. The Red Sea end of the bar lights up once the Red Sea miracle
// is unlocked.
import plaguesBar from "@/assets/ui-plagues-bar.png";
import type { GameState, PlagueId, UpgradeChoice } from "./types";

/** Serpent, leprosy and the ten plagues, in the order of the bar's slots. */
export const PLAGUE_BAR_ORDER: PlagueId[] = ["serpent", "leprosy", "blood", "frogs", "gnats", "flies", "livestock", "boils", "hail", "locusts", "darkness", "firstborn"];
const TEN_PLAGUES = PLAGUE_BAR_ORDER.slice(2);

// Slot geometry measured on the 1100x234 bar image: centre x/y and size of each
// slot. The two stacked attack slots are rounded squares, the plagues octagons.
const BAR_W = 1100;
const BAR_H = 234;
const SQUARE_SLOT = { w: 78, h: 72, square: true };
const PLAGUE_SLOT = { w: 74, h: 84, square: false };
const SLOTS = [
  { x: 76, y: 78, ...SQUARE_SLOT },
  { x: 76, y: 154, ...SQUARE_SLOT },
  ...[168, 245, 323, 403, 481, 557, 636, 714, 794, 875].map((x) => ({ x, y: 139, ...PLAGUE_SLOT })),
];
// Red Sea vignette at the right end (waves + staff).
const SEA = { x: 912, y: 4, w: 186, h: 226 };

const OCTAGON = "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)";
const ROUNDED = "inset(0 round 24%)";
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function PlagueBar({ state, choices }: { state: GameState; choices: UpgradeChoice[] }) {
  const owned = PLAGUE_BAR_ORDER.map((id) => state.plagues.has(id));
  const current = owned.lastIndexOf(true);
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
      <img src={plaguesBar} alt="Serpent, leprosy and the ten plagues" draggable={false} className="absolute inset-0 h-full w-full select-none" />
      {SLOTS.map((s, i) => {
        const box = { left: pct(s.x - s.w / 2, BAR_W), top: pct(s.y - s.h / 2, BAR_H), width: pct(s.w, BAR_W), height: pct(s.h, BAR_H) };
        const clip = s.square ? ROUNDED : OCTAGON;
        if (i === current) {
          return (
            <span key={i} className="pointer-events-none absolute" style={box}>
              <span className="absolute inset-0" style={{ clipPath: clip, background: "radial-gradient(circle, rgba(255,236,150,0.55) 30%, rgba(255,196,60,0.85) 72%, rgba(200,120,20,0.95) 100%)", mixBlendMode: "multiply", animation: "exodus-plague-glow 1.4s ease-in-out infinite" }} />
              {/* Marker above a plague; the stacked attack slots get it on their left, pointing right. */}
              <span
                className={s.square ? "absolute -translate-y-1/2" : "absolute left-1/2 -translate-x-1/2"}
                style={s.square ? { left: "-40%", top: "50%", width: "40%", rotate: "-90deg", animation: "exodus-new-bounce 0.9s ease-in-out infinite" } : { top: "-38%", width: "46%", animation: "exodus-new-bounce 0.9s ease-in-out infinite" }}
              >
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
