import { useSettings } from "@/hooks/useSettings";

/** Square-cornered pixel-art modal shell used by the in-game overlays. */
export function PixelModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(30,18,8,0.72)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[88%] max-w-sm border-[3px] border-[#3a2412] bg-[#FEEFBE] p-6"
        style={{ boxShadow: "0 6px 0 0 rgba(58,36,18,0.75)" }}
      >
        <h2 className="font-display mb-4 text-center text-lg uppercase tracking-[0.14em] text-[#4a2c10]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function PixelActionButton({
  children,
  variant = "ghost",
  ...rest
}: { children: React.ReactNode; variant?: "primary" | "ghost" } & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...rest}
      className={[
        "pixel-btn pixel-btn-press font-display w-full px-4 py-2.5 text-xs uppercase tracking-[0.14em]",
        variant === "primary" ? "bg-[#e9c168] text-[#3a2412]" : "bg-[#f6e2ad] text-[#4a2f16]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Compact in-game settings: language + sound toggle with volume slider. */
export function GameSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, update] = useSettings();
  return (
    <PixelModal open={open} onClose={onClose} title="Settings">
      <div className="font-pixel space-y-5 text-[#4a2f16]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm uppercase tracking-wider">Language</span>
          <select
            value={settings.language}
            onChange={() => {}}
            className="border-[3px] border-[#3a2412] bg-[#f6e2ad] px-2 py-1 text-xs uppercase"
          >
            <option value="en">English</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm uppercase tracking-wider">Sound</span>
          <button
            onClick={() => update({ volume: !settings.volume })}
            className="pixel-btn pixel-btn-press font-display bg-[#e9c168] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#3a2412]"
          >
            {settings.volume ? "On" : "Off"}
          </button>
        </div>

        {settings.volume && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider">
              <span>Volume</span>
              <span className="tabular-nums">{settings.volumeLevel}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.volumeLevel}
              onChange={(e) => update({ volumeLevel: Number(e.target.value) })}
              className="h-2 w-full appearance-none border-[3px] border-[#3a2412] bg-[#f6e2ad] accent-[#b5731f]"
            />
          </div>
        )}

        <PixelActionButton variant="primary" onClick={onClose}>
          Close
        </PixelActionButton>
      </div>
    </PixelModal>
  );
}
