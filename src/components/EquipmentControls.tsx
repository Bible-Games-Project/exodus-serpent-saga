import { CATEGORY_ITEMS } from "@/game/shopCatalog";
import { DEFAULT_TEST_EQUIPMENT, type TestEquipment } from "@/game/testEquipment";
export function EquipmentControls({ value = DEFAULT_TEST_EQUIPMENT, onChange }: { value?: TestEquipment; onChange: (value: TestEquipment) => void }) {
  const update = (patch: Partial<TestEquipment>) => onChange({ ...value, ...patch });
  return <div className="test-equipment-controls">
    <label>Front weapon<select aria-label="Front weapon" value={value.weapon} onChange={e => update({ weapon: e.target.value })}>{CATEGORY_ITEMS.weapon.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
    <label>Weapon level<select aria-label="Weapon level" value={value.weaponLevel} onChange={e => update({ weaponLevel: Number(e.target.value) })}>{[1, 2, 3].map(l => <option key={l} value={l}>Level {l}</option>)}</select></label>
    <label>Rear staff<select aria-label="Rear staff" value={value.staff} onChange={e => update({ staff: e.target.value })}>{CATEGORY_ITEMS.staff.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
    <label>Staff level<select aria-label="Staff level" value={value.staffLevel} onChange={e => update({ staffLevel: Number(e.target.value) })}>{[1, 2, 3].map(l => <option key={l} value={l}>Level {l}</option>)}</select></label>
    <label>Helmet<select aria-label="Helmet" value={value.helmet ?? "abel"} onChange={e => update({ helmet: e.target.value })}>{CATEGORY_ITEMS.shield.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
    <label>Footwear<select aria-label="Footwear" value={value.footwear ?? "barefoot"} onChange={e => update({ footwear: e.target.value })}>{CATEGORY_ITEMS.footwear.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
  </div>;
}