import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBlessing, inLightCone, weaponDot, DAGGER_CADENCE, DAGGER_POISON, DAGGER_THROW, RING_BOUNCES, daggerGestureSeconds, daggerTarget, updateWeaponAim, updateWeaponEntities, weaponLaunchProgress, weaponOnCast, weaponCooldownMul, weaponIsRangedOnly, weaponKnockback, weaponReachMul } from "./weapons";
import type { Entity, GameState, Vec2 } from "./types";
import { BRANCH_WIND_PUSH, BRANCH_WIND_WIDTH, DAGGER_RELEASE_PROGRESS, GROUND_IMPACT_DELAY, HARPOON_RETARGET_SECONDS, MACE_IMPACT_RADIUS, SWORD_ART, SWORD_CROSS_SCALE, groundStrikeAngle, heldHarpoonVisible, impactLife, spearAttack, thrustPose, turnWeaponAngle } from './weaponAttack';
import { mosesSwordTip } from './mosesGameArt';

const withWeapon = (id: string, evolution: number) => ({ loadout: { weapon: { id, evolution, dmg: 1 } } }) as unknown as GameState;

test("Ring rebounds 4, 8 and 12 times by level", () => {
  assert.deepEqual([...RING_BOUNCES], [4, 8, 12]);
});

test("Dagger poison chance and strength grow with level", () => {
  assert.ok(DAGGER_POISON[0].chance < DAGGER_POISON[1].chance);
  assert.ok(DAGGER_POISON[1].chance < DAGGER_POISON[2].chance);
  assert.ok(DAGGER_POISON[0].dps < DAGGER_POISON[2].dps);
});

test("Dagger attacks faster than the branch, faster at each level", () => {
  assert.equal(weaponCooldownMul(withWeapon("branch", 1)), 1);
  assert.ok(weaponCooldownMul(withWeapon("dagger", 1)) < 1);
  assert.ok(weaponCooldownMul(withWeapon("dagger", 3)) < weaponCooldownMul(withWeapon("dagger", 2)));
});

test("Sword reach is 1x, 1.5x and 2x by level", () => {
  assert.deepEqual([1, 2, 3].map(l => weaponReachMul(withWeapon("sword", l))), [1, 1.5, 2]);
});

test("Boomerang, ring and harpoon are thrown only; spear is melee", () => {
  assert.equal(weaponIsRangedOnly("boomerang"), true);
  assert.equal(weaponIsRangedOnly("ring"), true);
  assert.equal(weaponIsRangedOnly("harpoon"), true);
  assert.equal(weaponIsRangedOnly("spear"), false);
});

function enemy(id: number, x: number, y: number): Entity {
  return { id, kind: 'soldier', team: 'enemy', pos: { x, y }, vel: { x: 0, y: 0 }, hp: 1000, maxHp: 1000, radius: 10, facing: 1, animT: 0, born: 0, data: {} };
}
function arena(id: string, evo = 1): GameState {
  return { ...withWeapon(id, evo), now: 10, worldW: 8192, worldH: 8192, player: { ...enemy(0, 1000, 1000), kind: 'moses', team: 'player', facing: 1 }, entities: new Map(), input: { x: 0, y: 0 } } as unknown as GameState;
}
function spawner(state: GameState) {
  let id = 100;
  return (kind: string, pos: Vec2, ttl: number, data: Record<string, unknown>, team: Entity['team'] = 'projectile') => {
    const e = { ...enemy(id++, pos.x, pos.y), kind, ttl, data, team, born: state.now };
    state.entities.set(e.id, e); return e;
  };
}
/** Cast, then advance to the gesture's release beat so the dagger leaves the hand. */
function throwDagger(s: GameState, basic?: number) {
  const spawn = spawner(s);
  weaponOnCast(s, spawn, basic);
  assert.equal([...s.entities.values()].filter(e => e.kind === 'wpnproj').length, 0);
  s.now += daggerGestureSeconds(Number(s.loadout?.weapon.evolution ?? 1)) * DAGGER_RELEASE_PROGRESS + .001;
  updateWeaponEntities(s, .001, { wrapDelta: (a, b) => a - b, killEnemy: () => {}, spawn });
}
test('Dagger throws exactly one dagger per hand motion at every level', () => {
  const counts: number[] = [];
  for (let evo = 1; evo <= 3; evo++) {
    const s = arena('dagger', evo); s.entities.set(1, enemy(1, 1080, 1000));
    throwDagger(s);
    const projectiles = [...s.entities.values()].filter(e => e.kind === 'wpnproj');
    counts.push(projectiles.length);
    assert.equal(projectiles[0].ttl, DAGGER_THROW[evo - 1].reach / 400);
    assert.ok(projectiles.every(e => Number(e.data?.vx) > 0));
  }
  assert.deepEqual(counts, [1, 1, 1]);
  // Faster at each level, but a gentle progression (level III well under 2x level I).
  const [c1, c2, c3] = [1, 2, 3].map(l => weaponCooldownMul(withWeapon('dagger', l)));
  assert.ok(c1 > c2 && c2 > c3);
  assert.ok(c1 / c3 < 1.6);
  assert.deepEqual([...DAGGER_CADENCE], [.7, .58, .48]);
});
test('Thrown daggers leave from the hand, at hand height', () => {
  const s = arena('dagger'); s.entities.set(1, enemy(1, 1200, 1000)); throwDagger(s);
  const d = [...s.entities.values()].find(e => e.kind === 'wpnproj')!;
  assert.ok(d.pos.x > s.player.pos.x + 15);
  assert.ok(Number(d.data?.lift) > 30 && Number(d.data?.lift) < 45);
});
test('Dagger ignores a closer rear enemy and aims its centre projectile at nearest forward enemy', () => {
  const s = arena('dagger'); s.entities.set(1, enemy(1, 995, 1000)); s.entities.set(2, enemy(2, 1060, 1040)); s.entities.set(3, enemy(3, 1100, 1000));
  assert.equal(daggerTarget(s)?.id, 2); throwDagger(s);
  const centre = [...s.entities.values()].filter(e => e.kind === 'wpnproj')[0];
  assert.ok(Math.abs(Number(centre.data?.vy) / Number(centre.data?.vx) - (1040 - centre.pos.y) / (1060 - centre.pos.x)) < .0001);
  s.player.facing = -1; assert.equal(daggerTarget(s)?.id, 1);
});
test('Dagger throw gesture speeds up with the attack cadence', () => {
  for (const evo of [1,2,3]) {
    const s=arena('dagger',evo); s.equipFx={weaponVisualAt:10};
    const dur = daggerGestureSeconds(evo);
    assert.ok(Math.abs(dur / daggerGestureSeconds(1) - DAGGER_CADENCE[evo-1] / DAGGER_CADENCE[0]) < 1e-9);
    s.now=10+dur*.2;
    assert.ok(Math.abs(Number(weaponLaunchProgress(s))-.2)<1e-9);
    s.now=10+dur+.0001; assert.equal(weaponLaunchProgress(s),null);
  }
});
test('Mace keeps exact 48, 96 and 128 impact radii at every evolution', () => {
  assert.deepEqual([...MACE_IMPACT_RADIUS],[48,96,128]);
  assert.deepEqual([1,2,3].map(evo=>{
    const s=arena('mace',evo);weaponOnCast(s,spawner(s));
    return [...s.entities.values()].find(e=>e.kind==='maceimpact')?.data?.r;
  }),[48,96,128]);
});
test('Every branch level emits one aimed gust, always in front of the branch, with increasing artwork size', () => {
  assert.ok(BRANCH_WIND_WIDTH[0]<BRANCH_WIND_WIDTH[1] && BRANCH_WIND_WIDTH[1]<BRANCH_WIND_WIDTH[2]);
  for(const evo of [1,2,3]) {
    const s=arena('branch',evo);s.entities.set(1,enemy(1,1000,900));weaponOnCast(s,spawner(s));
    const gusts=[...s.entities.values()].filter(e=>e.kind==='branchwind');
    assert.equal(gusts.length,1);assert.equal(gusts[0].data?.evo,evo);const a=Number(gusts[0].data?.angle);assert.ok(Math.cos(a)>0&&Math.sin(a)<-.8,"forward and upward");
  }
});
test('Dagger permits above/below enemies and uses nearest wrapped forward copy', () => {
  const s = arena('dagger'); s.entities.set(1, enemy(1, 1000, 950)); assert.equal(daggerTarget(s)?.id, 1);
  s.entities.set(1, enemy(1, 1000, 1050)); assert.equal(daggerTarget(s)?.id, 1);
  s.player.pos.x = 8180; s.entities.set(1, enemy(1, 20, 1000)); assert.equal(daggerTarget(s)?.id, 1);
});
test('Rear-only targets create no dagger projectiles or launch gesture', () => {
  const s = arena('dagger'); s.entities.set(1, enemy(1, 950, 1000)); weaponOnCast(s, spawner(s));
  assert.equal([...s.entities.values()].filter(e => e.kind === 'wpnproj').length, 0);
  assert.equal(weaponLaunchProgress(s), null);
});
test('Throw gesture resets and only refreshes on another successful ring/boomerang launch', () => {
  for (const id of ['ring', 'boomerang']) {
    const s = arena(id); const spawn = spawner(s); weaponOnCast(s, spawn);
    assert.equal(weaponLaunchProgress(s), 0); s.now += .51;
    assert.ok([...s.entities.values()].some(e => e.team === 'projectile'));
    assert.equal(weaponLaunchProgress(s), null);
    weaponOnCast(s, spawn); assert.equal(weaponLaunchProgress(s), 0);
  }
});
test('Axe displaces only struck enemies away from its recorded handle, once per impact', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const s = arena('axe'); const hit = enemy(1, 1000 + Math.cos(angle) * 70, 1000 + Math.sin(angle) * 70);
    s.player.facing = Math.cos(angle) < -.5 ? -1 : 1; // the cast turns Moses toward the cut
    const miss = enemy(2, 1400, 1400); s.entities.set(1, hit); s.entities.set(2, miss);
    const spawn = spawner(s); spawn('axeline', {x:1000 + Math.cos(angle) * 75,y:1000 + Math.sin(angle) * 75}, .45, {len:150,wid:22,angle,dmg:14,handleX:1000,handleY:1000,knock:18,hit:[]}, 'hazard');
    const ctx = { wrapDelta:(a:number,b:number) => a-b, killEnemy:()=>{},spawn };
    updateWeaponEntities(s, .01, ctx);
    assert.ok(Math.abs(Math.hypot(hit.pos.x - 1000, hit.pos.y - 1000) - 88) < .001);
    assert.equal(hit.hp, 986); assert.deepEqual(miss.pos, {x:1400,y:1400});
    updateWeaponEntities(s, .01, ctx); assert.equal(hit.hp, 986);
    assert.ok(Math.abs(Math.hypot(hit.pos.x - 1000, hit.pos.y - 1000) - 88) < .001);
  }
});
test('Dagger collision applies the established poison to the hit enemy only', () => {
  const s = arena('dagger', 3); const target = enemy(1, 1080, 1000), other = enemy(2, 950, 1000);
  s.entities.set(1,target); s.entities.set(2,other); const spawn = spawner(s);
  spawn('wpnproj',{...target.pos},1,{vx:0,vy:0,dmg:14,pierce:1,poisonEvo:3,art:'dagger'},'projectile');
  const random = Math.random; Math.random = () => 0;
  try { updateWeaponEntities(s,.01,{wrapDelta:(a,b)=>a-b,killEnemy:()=>{},spawn}); } finally { Math.random = random; }
  assert.equal(target.data?.poisonUntil, 18); assert.equal(other.data?.poisonUntil, undefined);
  assert.equal(s.player.data?.poisonUntil, undefined);
});
test('Dagger projectiles preserve the supplied basic attack damage', () => {
  const s = arena('dagger'); s.entities.set(1, enemy(1,1080,1000));
  throwDagger(s, 37);
  const projectiles = [...s.entities.values()].filter(e => e.kind === 'wpnproj');
  assert.equal(projectiles.length, 1);
  assert.ok(projectiles.every(e => e.data?.dmg === 37));
});
test('A flying dagger retains its poison evolution after equipment changes', () => {
  const s = arena('branch'); const target = enemy(1,1080,1000); s.entities.set(1,target);
  const spawn=spawner(s); spawn('wpnproj',{...target.pos},1,{vx:0,vy:0,dmg:14,pierce:1,poisonEvo:3,art:'dagger'},'projectile');
  const random=Math.random; Math.random=()=>0;
  try { updateWeaponEntities(s,.01,{wrapDelta:(a,b)=>a-b,killEnemy:()=>{},spawn}); } finally { Math.random=random; }
  assert.equal(target.data?.poisonUntil,18);
  assert.equal(target.data?.poisonSpread,1);
});

test('Spear evolves shaft reach and attacks faster than the branch', () => {
  assert.deepEqual([1,2,3].map(e => spearAttack(e).reach), [110,155,200]);
  assert.deepEqual([1,2,3].map(e => spearAttack(e).shaft), [70,115,160]);
  assert.deepEqual([1,2,3].map(e => weaponCooldownMul(withWeapon('spear',e))), [.7,.6,.5]);
});
test('Spear aims at nearest live enemy in any direction, rather than facing', () => {
  const s = arena('spear',3); s.entities.set(1,enemy(1,980,960)); s.entities.set(2,enemy(2,1090,1000));
  const dead = enemy(3,1001,1000); dead.hp=0; s.entities.set(3,dead);
  weaponOnCast(s,spawner(s));
  const fx=[...s.entities.values()].find(e=>e.kind==='spearthrust');
  assert.ok(fx); assert.equal(fx.data?.len,200);
  assert.ok(Math.abs(Number(fx.data?.angle)-Math.atan2(-40,-20))<.00001);
  assert.equal(s.player.facing,-1);
  assert.equal([...s.entities.values()].filter(e=>e.team==='projectile').length,0);
});
test('Harpoon remains level in its idle pose and points its thrust at the launch target', () => {
  assert.equal(thrustPose(null,0,1).angle,Math.PI/2);
  const s=arena('harpoon'); s.entities.set(1,enemy(1,1080,1040)); weaponOnCast(s,spawner(s));
  const pose=thrustPose(.6,Number(s.equipFx?.weaponAimAngle),1);
  assert.ok(Math.abs(pose.y/pose.x-.5)<.00001);
  const spawn=spawner(s);
  assert.equal([...s.entities.values()].filter(e=>e.kind==='wpnproj').length,0);
  s.now=10.3; updateWeaponEntities(s,.01,{wrapDelta:(a,b)=>a-b,killEnemy:()=>{},spawn});
  assert.equal([...s.entities.values()].filter(e=>e.kind==='wpnproj').length,1);
});
test('Axe and mace cracks and damage wait until the shared contact beat', () => {
  for (const id of ['axe','mace']) {
    const s=arena(id); const en=enemy(1,1064,1000); s.entities.set(1,en);
    const spawn=spawner(s); weaponOnCast(s,spawn);
    const fx=[...s.entities.values()].find(e=>e.kind===(id==='axe'?'axeline':'maceimpact'));
    assert.ok(fx); assert.equal(fx.data?.impactAt,10+GROUND_IMPACT_DELAY);
    const ctx={wrapDelta:(a:number,b:number)=>a-b,killEnemy:()=>{},spawn};
    s.now=10+GROUND_IMPACT_DELAY-.01; updateWeaponEntities(s,.01,ctx); assert.equal(en.hp,1000);
    assert.equal(impactLife(s.now,Number(fx.data?.impactAt),.4),0);
    s.now=10+GROUND_IMPACT_DELAY+.001; updateWeaponEntities(s,.01,ctx); assert.ok(en.hp<1000);
    assert.equal(groundStrikeAngle(GROUND_IMPACT_DELAY/.5),1.8);
  }
});
test('Mace impacts alternate horizontal mirroring on consecutive strikes', () => {
  const s=arena('mace',3); const spawn=spawner(s);
  weaponOnCast(s,spawn); weaponOnCast(s,spawn); weaponOnCast(s,spawn);
  const flips=[...s.entities.values()].filter(e=>e.kind==='maceimpact').map(e=>e.data?.flipX);
  assert.deepEqual(flips,[-1,1,-1]);
});

test('Branch evolution doubles the original 0.03-second attack interval reduction', () => {
  assert.deepEqual([1,2,3].map(e => Number((.55 * weaponCooldownMul(withWeapon('branch',e))).toFixed(2))), [.55,.49,.43]);
});
test('Branch evolved knockback doubles its previous 14-pixel evolution bonus', () => {
  assert.deepEqual([1,2,3].map(e => weaponKnockback(withWeapon('branch',e))), [10,20,30]);
});
test('Spear knockback is stronger at all three levels', () => {
  assert.deepEqual([1,2,3].map(e => weaponKnockback(withWeapon('spear',e))), [28,44,56]);
});
test('Spear tip resolves the same world direction for both mirrored body poses', () => {
  for (const facing of [-1,1]) for (const angle of [0,.5,Math.PI/2,Math.PI,-Math.PI/2,-2.4]) {
    const pose=thrustPose(.6,angle,facing);
    const tipX=Math.sin(pose.angle)*facing, tipY=-Math.cos(pose.angle);
    assert.ok(Math.abs(tipX-Math.cos(angle))<.000001);
    assert.ok(Math.abs(tipY-Math.sin(angle))<.000001);
  }
});
test('Spear turns rapidly along the shortest path without snapping on a new target', () => {
  const s=arena('spear'); s.equipFx={weaponVisualAim:0}; s.entities.set(1,enemy(1,1000,900));
  updateWeaponAim(s,1/60);
  assert.ok(Number(s.equipFx.weaponVisualAim)<0 && Number(s.equipFx.weaponVisualAim)>-Math.PI/2);
  for(let i=0;i<15;i++) updateWeaponAim(s,1/60);
  assert.ok(Math.abs(Number(s.equipFx.weaponVisualAim)+Math.PI/2)<.01);
  assert.ok(turnWeaponAngle(Math.PI-.01,-Math.PI+.01,1/60)>Math.PI-.01);
});
test('Held harpoon disappears on launch and returns at exactly 0.5 seconds', () => {
  assert.equal(heldHarpoonVisible(10,undefined),true);
  assert.equal(heldHarpoonVisible(10,10),false);
  assert.equal(heldHarpoonVisible(10.499,10),false);
  assert.equal(heldHarpoonVisible(10.5,10),true);
});
test('Only axe III freezes hit enemies for exactly 0.5 seconds at impact', () => {
  for (const evo of [1,2,3]) {
    const s=arena('axe',evo), en=enemy(1,1064,1000), miss=enemy(2,1000,1300);
    s.entities.set(1,en);s.entities.set(2,miss);const spawn=spawner(s);weaponOnCast(s,spawn);
    s.now=10.301;updateWeaponEntities(s,.001,{wrapDelta:(a,b)=>a-b,killEnemy:()=>{},spawn});
    assert.equal(en.data?.axeFreezeUntil,evo===3?10.801:undefined);
    assert.equal(miss.data?.axeFreezeUntil,undefined);
  }
});
test('Sword is melee only: no wind cross is spawned at any level', () => {
  for (const evo of [1,2,3]) {
    const s=arena('sword',evo);s.entities.set(1,enemy(1,1300,1000));weaponOnCast(s,spawner(s));
    assert.equal([...s.entities.values()].some(e=>e.kind==='swordwind'),false);
  }
});

test('A thrown harpoon re-reads its target every 0.3 s and turns smoothly toward it', () => {
  const s = arena('harpoon'); const target = enemy(1, 1200, 1000); s.entities.set(1, target);
  const spawn = spawner(s); weaponOnCast(s, spawn);
  const ctx = { wrapDelta: (a: number, b: number) => a - b, killEnemy: () => {}, spawn };
  s.now = 10.3; updateWeaponEntities(s, .01, ctx);
  const h = [...s.entities.values()].find(e => e.kind === 'wpnproj')!;
  assert.equal(h.data?.targetId, 1);
  s.now += .01; updateWeaponEntities(s, .01, ctx); // first aim, taken on release
  // The target walks well below the original line.
  target.pos.y = 1150;
  const angleOf = () => Math.atan2(Number(h.data?.vy), Number(h.data?.vx));
  const aim = Number(h.data?.aimAngle);
  s.now += .01; updateWeaponEntities(s, .01, ctx);
  assert.equal(Number(h.data?.aimAngle), aim, 'no re-aim before the 0.3 s refresh');
  const before = angleOf();
  s.now += HARPOON_RETARGET_SECONDS; updateWeaponEntities(s, .016, ctx);
  const turned = angleOf();
  assert.ok(turned > before, 'turns toward the moved target');
  const wanted = Math.atan2(target.pos.y - h.pos.y, target.pos.x - h.pos.x);
  assert.ok(turned < wanted, 'eases rather than snapping');
  assert.ok(Math.abs(Math.hypot(Number(h.data?.vx), Number(h.data?.vy)) - 400) < 1e-6);
});
test('Branch gust pushes back each foe it crosses once, more at each level', () => {
  const pushes: number[] = [];
  for (const evo of [1, 2, 3]) {
    const s = arena('branch', evo); const en = enemy(1, 1080, 1000); s.entities.set(1, en);
    const spawn = spawner(s); weaponOnCast(s, spawn);
    const gust = [...s.entities.values()].find(e => e.kind === 'branchwind')!;
    const ctx = { wrapDelta: (a: number, b: number) => a - b, killEnemy: () => {}, spawn };
    for (let t = Number(gust.data?.impactAt); t < Number(gust.data?.impactAt) + .45; t += .02) {
      s.now = t; updateWeaponEntities(s, .02, ctx);
    }
    assert.ok(Number(en.data?.knockVx) > 0);
    assert.deepEqual(gust.data?.hit, [1]);
    pushes.push(Number(en.data?.knockVx) * .11);
  }
  assert.deepEqual(pushes.map(p => Math.round(p)), [...BRANCH_WIND_PUSH]);
});
test('A blessed attack carries the Staff of Moses blessing on its thrown weapon, once', () => {
  const s = arena('boomerang'); s.entities.set(1, enemy(1, 1100, 1000));
  s.equipFx = { empowered: 1, blessEvo: 2, blessId: 7 };
  const spawn = spawner(s); weaponOnCast(s, spawn);
  const b = [...s.entities.values()].find(e => e.kind === 'wpboom')!;
  assert.equal(b.data?.empowered, 1);
  assert.equal(b.data?.blessEvo, 2);
  s.entities.clear(); s.entities.set(1, enemy(1, 1100, 1000)); weaponOnCast(s, spawn);
  const plain = [...s.entities.values()].find(e => e.kind === 'wpboom')!;
  assert.equal(plain.data?.empowered, 0);
  assert.ok(!plain.data?.blessEvo);
});
test('Blessing levels: half max HP, then 75% of what is left, then death; once per attack; never bosses', () => {
  const foe = (hp: number, kind = 'soldier', data: Record<string, unknown> = {}) => ({ ...enemy(1, 0, 0), kind, hp, maxHp: 100, data }) as Entity;
  const a = foe(80); applyBlessing(a, { blessEvo: 1, blessId: 1 }); assert.equal(a.hp, 30);
  applyBlessing(a, { blessEvo: 1, blessId: 1 }); assert.equal(a.hp, 30);
  const b = foe(80); applyBlessing(b, { blessEvo: 2, blessId: 1 }); assert.equal(b.hp, 20);
  const c = foe(80); applyBlessing(c, { blessEvo: 3, blessId: 1 }); assert.equal(c.hp, 0);
  for (const tough of [foe(80, 'ramses'), foe(80, 'soldier', { enemyChampion: 1 })]) {
    applyBlessing(tough, { blessEvo: 3, blessId: 1 }); assert.equal(tough.hp, 80);
  }
});
test('Diamond bleeding drains ordinary foes until death but never bosses', () => {
  const s = arena('branch');
  const cut = { ...enemy(1, 0, 0), hp: 100, maxHp: 100, data: { bleedDps: 10 } } as Entity;
  const boss = { ...enemy(2, 0, 0), kind: 'ramses', hp: 100, maxHp: 100, data: { bleedDps: 10 } } as Entity;
  weaponDot(s, cut, 1); weaponDot(s, boss, 1);
  assert.equal(cut.hp, 90); assert.equal(boss.hp, 100);
});
test('Divine Light cone covers the beam foot and narrows toward the sky', () => {
  assert.ok(inLightCone(0, 0, 260));
  assert.ok(inLightCone(60, 0, 260));
  assert.ok(!inLightCone(120, 0, 260));
  assert.ok(inLightCone(0, -150, 260));
  assert.ok(!inLightCone(60, -150, 260));
  assert.ok(!inLightCone(0, 80, 260));
});
