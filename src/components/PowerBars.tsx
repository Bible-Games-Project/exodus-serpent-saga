import { POWER_BAR_MAX } from "@/game/shopStats";
export function PowerBars({ label, bars }: { label: string; bars: number }) {
  return <div className="shop-power-stat" aria-label={`${label}: ${bars} of ${POWER_BAR_MAX}`}>
    <span className="shop-power-label">{label}</span>
    <span className="shop-power-bars" aria-hidden>{Array.from({ length: POWER_BAR_MAX }, (_, i) => <i key={i} data-active={i < bars} />)}</span>
  </div>;
}