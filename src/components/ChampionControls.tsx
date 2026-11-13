import { testChampionIds, testChampionInfo } from "@/game/testMap";
import type { TestMapConfig } from "@/game/types";

/** Test Map: turn each champion on or off and pick its level (1-3). */
export function ChampionControls({ value, onChange }: { value: TestMapConfig; onChange: (patch: Pick<TestMapConfig, "champions" | "championLevels">) => void }) {
  const champions = value.champions ?? {};
  const levels = value.championLevels ?? {};
  const ids = testChampionIds();
  const all = ids.every((id) => champions[id]);
  return <div className="test-champion-controls">
    <div className="test-champion-head">
      <strong>Champions</strong>
      <button type="button" className="pixel-btn pixel-btn-press" onClick={() => onChange({ champions: Object.fromEntries(ids.map((id) => [id, !all])), championLevels: levels })}>
        {all ? "None" : "All"}
      </button>
    </div>
    {ids.map((id) => {
      const info = testChampionInfo(id);
      const on = champions[id] === true;
      const level = Math.max(1, Math.min(3, Number(levels[id] ?? 1)));
      return <div key={id} className={`test-champion-row${on ? " is-on" : ""}`}>
        <span className="test-champion-sprite">{info.url ? <img src={info.url} alt="" aria-hidden /> : null}</span>
        <span className="test-champion-name">{info.name}</span>
        <button type="button" aria-pressed={on} aria-label={`${info.name} ${on ? "on" : "off"}`} className="pixel-btn pixel-btn-press"
          onClick={() => onChange({ champions: { ...champions, [id]: !on }, championLevels: levels })}>{on ? "On" : "Off"}</button>
        <span className="test-champion-levels" role="group" aria-label={`${info.name} level`}>
          {[1, 2, 3].map((l) => <button key={l} type="button" aria-pressed={level === l} className={`pixel-btn pixel-btn-press${level === l ? " is-active" : ""}`}
            onClick={() => onChange({ champions, championLevels: { ...levels, [id]: l } })}>{["I", "II", "III"][l - 1]}</button>)}
        </span>
      </div>;
    })}
  </div>;
}
