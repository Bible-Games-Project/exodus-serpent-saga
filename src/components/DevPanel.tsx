import { useState } from "react";
import { PixelActionButton } from "@/components/GameSettingsDialog";
import { DEFAULT_DEV_CONFIG, type DevConfig } from "@/game/devMode";

/**
 * Dev-only pre-match configuration panel. This module is only ever imported
 * behind a `DEV_ENABLED` check, so it is excluded from production bundles.
 */
export function DevPanel({ onStart }: { onStart: (cfg: DevConfig) => void }) {
  const [level, setLevel] = useState(DEFAULT_DEV_CONFIG.startLevel);
  const [plagueLevel, setPlagueLevel] = useState(1);
  const [allPlagues, setAllPlagues] = useState(false);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(30,18,8,0.82)] p-3">
      <div
        className="pixel-panel w-[92%] max-w-sm bg-[#FEEFBE] p-6"
        style={{ boxShadow: "0 6px 0 0 rgba(58,36,18,0.75)" }}
      >
        <h2 className="font-display mb-4 text-center text-lg uppercase tracking-[0.14em] text-[#4a2c10]">
          Game Dev
        </h2>
        <div className="font-pixel space-y-5 text-[#4a2f16]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm uppercase tracking-wider">Start level</span>
            <input
              type="number"
              min={1}
              max={999}
              value={level}
              onChange={(e) => setLevel(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
              className="w-20 border-[3px] border-[#3a2412] bg-[#f6e2ad] px-2 py-1 text-center text-sm tabular-nums focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm uppercase tracking-wider">All powers</span>
            <button
              onClick={() => setAllPlagues((v) => !v)}
              className="pixel-btn pixel-btn-press font-display bg-[#e9c168] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#3a2412]"
            >
              {allPlagues ? "On" : "Off"}
            </button>
          </div>

          {!allPlagues && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm uppercase tracking-wider">Plague level</span>
              <input
                type="number"
                min={0}
                max={999}
                value={plagueLevel}
                onChange={(e) => setPlagueLevel(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
                className="w-20 border-[3px] border-[#3a2412] bg-[#f6e2ad] px-2 py-1 text-center text-sm tabular-nums focus:outline-none"
              />
            </div>
          )}
          <p className="text-[10px] uppercase tracking-wider text-[#8a5a2c]">
            Plague level 0 = normal start. Test session only.
          </p>

          <PixelActionButton
            variant="primary"
            onClick={() =>
              onStart({
                startLevel: level,
                plagues: allPlagues ? "all" : plagueLevel <= 0 ? "none" : plagueLevel,
              })
            }
          >
            Start run
          </PixelActionButton>
        </div>
      </div>
    </div>
  );
}
