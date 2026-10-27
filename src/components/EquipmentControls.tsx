import { CATEGORY_ITEMS, type EquipItem } from "@/game/shopCatalog";
import { DEFAULT_TEST_EQUIPMENT, NONE, type TestEquipment } from "@/game/testEquipment";
import { equipmentStats } from "@/game/shopStats";
import { PowerBars } from "./PowerBars";

function ItemInfo({ title, items, id, level }: { title: string; items: EquipItem[]; id?: string; level: number }) {
  if (!id || id === NONE) return <div className="test-equipment-info"><strong>{title}: unequipped</strong></div>;
  const item = items.find(i => i.id === id);
  const evo = item?.evolutions[Math.min(level, item.evolutions.length) - 1];
  if (!item || !evo) return null;
  return <div className="test-equipment-info">
    <strong>{title}: {evo.name}</strong>
    <p>{evo.stat}{evo.ability ? ` · ${evo.ability}` : ""}</p>
    {equipmentStats(evo, item).map(s => <PowerBars key={s.label} label={s.label} bars={s.bars} />)}
  </div>;
}

export function EquipmentControls({ value = DEFAULT_TEST_EQUIPMENT, onChange }: { value?: TestEquipment; onChange: (value: TestEquipment) => void }) {
  const update = (patch: Partial<TestEquipment>) => onChange({ ...value, ...patch });
  const none = <option value={NONE}>Unequip</option>;
  return <>
    <div className="test-equipment-controls">
      <label>Front weapon<select aria-label="Front weapon" value={value.weapon} onChange={e => update({ weapon: e.target.value })}>{none}{CATEGORY_ITEMS.weapon.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <label>Weapon level<select aria-label="Weapon level" value={value.weaponLevel} onChange={e => update({ weaponLevel: Number(e.target.value) })}>{[1, 2, 3].map(l => <option key={l} value={l}>Level {l}</option>)}</select></label>
      <label>Rear staff<select aria-label="Rear staff" value={value.staff} onChange={e => update({ staff: e.target.value })}>{none}{CATEGORY_ITEMS.staff.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <label>Staff level<select aria-label="Staff level" value={value.staffLevel} onChange={e => update({ staffLevel: Number(e.target.value) })}>{[1, 2, 3].map(l => <option key={l} value={l}>Level {l}</option>)}</select></label>
      <label>Helmet<select aria-label="Helmet" value={value.helmet ?? "abel"} onChange={e => update({ helmet: e.target.value })}>{none}{CATEGORY_ITEMS.shield.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <label>Footwear<select aria-label="Footwear" value={value.footwear ?? "barefoot"} onChange={e => update({ footwear: e.target.value })}>{none}{CATEGORY_ITEMS.footwear.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
    </div>
    <div className="test-equipment-infos">
      <ItemInfo title="Weapon" items={CATEGORY_ITEMS.weapon} id={value.weapon} level={value.weaponLevel} />
      <ItemInfo title="Staff" items={CATEGORY_ITEMS.staff} id={value.staff} level={value.staffLevel} />
      <ItemInfo title="Helmet" items={CATEGORY_ITEMS.shield} id={value.helmet ?? "abel"} level={1} />
      <ItemInfo title="Footwear" items={CATEGORY_ITEMS.footwear} id={value.footwear ?? "barefoot"} level={1} />
    </div>
  </>;
}
