// Level-up plague progress: the painted ten-plagues bar with the plagues already
// sent shown lit, the latest one ringed in gold with a marker above it, the
// next one (when this level up offers to unlock it) glowing, and the ones still
// to come faded. The Red Sea end of the bar lights up once the Red Sea miracle
// is unlocked.
import plaguesBar from "@/assets/ui-plagues-bar.png";
import type { GameState, PlagueId, UpgradeChoice } from "./types";

/** The ten plagues, in the order of the bar's slots. */
export const PLAGUE_BAR_ORDER: PlagueId[] = ["blood", "frogs", "gnats", "flies", "livestock", "boils", "hail", "locusts", "darkness", "firstborn"];

// Slot geometry measured on the 960x221 bar image.
const BAR_W = 960;
const BAR_H = 221;
const SLOT_X = [60, 137, 213, 290, 366, 441, 518, 594, 670, 747];
const SLOT_Y = 130;
const SLOT_W = 72;
const SLOT_H = 82;
// Red Sea vignette at the right end (waves + staff).
const SEA = { x: 782, y: 6, w: 172, h: 208 };

const OCTAGON = "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)";
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function PlagueBar({ state, choices }: { state: GameState; choices: UpgradeChoice[] }) {
  const owned = PLAGUE_BAR_ORDER.map((id) => state.plagues.has(id));
  const current = owned.lastIndexOf(true);
  const offered = choices.find((c) => c.isUnlock && c.plague && PLAGUE_BAR_ORDER.includes(c.plague))?.plague;
  const next = offered ? PLAGUE_BAR_ORDER.indexOf(offered) : -1;
  const seaOn = state.plagues.has("redsea");
  return (
    <div
      className="relative mx-auto mb-2 shrink-0 sm:mb-3"
      style={{ width: `min(100%, calc(clamp(44px, 10vh, 96px) * ${BAR_W / BAR_H}))`, aspectRatio: `${BAR_W} / ${BAR_H}` }}
      title={current >= 0 ? `Plagues sent: ${current + 1} of 10` : "No plague sent yet"}
    >
      <img src={plaguesBar} alt="The ten plagues" draggable={false} className="absolute inset-0 h-full w-full select-none" />
      {SLOT_X.map((x, i) => {
        const box = { left: pct(x - SLOT_W / 2, BAR_W), top: pct(SLOT_Y - SLOT_H / 2, BAR_H), width: pct(SLOT_W, BAR_W), height: pct(SLOT_H, BAR_H) };
        if (i === current) {
          return (
            <span key={i} className="pointer-events-none absolute" style={box}>
              <span className="absolute inset-0" style={{ clipPath: OCTAGON, background: "radial-gradient(circle, rgba(255,236,150,0.55) 30%, rgba(255,196,60,0.85) 72%, rgba(200,120,20,0.95) 100%)", mixBlendMode: "multiply", animation: "exodus-plague-glow 1.4s ease-in-out infinite" }} />
              <span className="absolute left-1/2 -translate-x-1/2" style={{ top: "-38%", width: "46%", animation: "exodus-new-bounce 0.9s ease-in-out infinite" }}>
                <svg viewBox="0 0 12 10" className="block w-full" aria-hidden>
                  <path d="M0 0h12L6 10z" fill="#3a2412" />
                  <path d="M2.2 1.3h7.6L6 7.6z" fill="#ffd34d" />
                </svg>
              </span>
            </span>
          );
        }
        if (owned[i]) {
          return <span key={i} className="pointer-events-none absolute" style={{ ...box, clipPath: OCTAGON, background: "rgba(255,214,110,0.35)", mixBlendMode: "multiply" }} />;
        }
        return (
          <span
            key={i}
            className="pointer-events-none absolute"
            style={{ ...box, clipPath: OCTAGON, background: i === next ? "rgba(255,240,190,0.25)" : "rgba(250,226,176,0.68)", boxShadow: i === next ? "inset 0 0 0 3px #ffd34d" : undefined, animation: i === next ? "exodus-plague-glow 0.9s ease-in-out infinite" : undefined }}
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
