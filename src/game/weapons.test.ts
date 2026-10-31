import { test } from "node:test";
import assert from "node:assert/strict";
import { DAGGER_POISON, DAGGER_THROW, RING_BOUNCES, daggerTarget, updateWeaponEntities, weaponLaunchProgress, weaponOnCast, weaponCooldownMul, weaponIsRangedOnly, weaponReachMul } from "./weapons";
import type { Entity, GameState, Vec2 } from "./types";
import { GROUND_IMPACT_DELAY, groundStrikeAngle, impactLife, spearAttack, thrustPose } from './weaponAttack';

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
test('Dagger I throws three; II and III throw more with longer reach and wider spread', () => {
  const counts: number[] = [];
  for (let evo = 1; evo <= 3; evo++) {
    const s = arena('dagger', evo); s.entities.set(1, enemy(1, 1080, 1000));
    weaponOnCast(s, spawner(s));
    const projectiles = [...s.entities.values()].filter(e => e.kind === 'wpnproj');
    counts.push(projectiles.length);
    assert.equal(projectiles[0].ttl, DAGGER_THROW[evo - 1].reach / 400);
    assert.ok(projectiles.every(e => Number(e.data?.vx) > 0));
  }
  assert.deepEqual(counts, [3, 5, 7]);
  assert.ok(DAGGER_THROW[0].reach < DAGGER_THROW[1].reach && DAGGER_THROW[1].reach < DAGGER_THROW[2].reach);
  assert.ok(DAGGER_THROW[0].spread < DAGGER_THROW[1].spread && DAGGER_THROW[1].spread < DAGGER_THROW[2].spread);
});
test('Dagger ignores a closer rear enemy and aims its centre projectile at nearest forward enemy', () => {
  const s = arena('dagger'); s.entities.set(1, enemy(1, 995, 1000)); s.entities.set(2, enemy(2, 1060, 1040)); s.entities.set(3, enemy(3, 1100, 1000));
  assert.equal(daggerTarget(s)?.id, 2); weaponOnCast(s, spawner(s));
  const centre = [...s.entities.values()].filter(e => e.kind === 'wpnproj')[1];
  assert.ok(Math.abs(Number(centre.data?.vy) / Number(centre.data?.vx) - 40 / 60) < .0001);
  s.player.facing = -1; assert.equal(daggerTarget(s)?.id, 1);
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
  weaponOnCast(s, spawner(s), 37);
  const projectiles = [...s.entities.values()].filter(e => e.kind === 'wpnproj');
  assert.equal(projectiles.length, 3);
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
test('Mace crack rotation is chosen once per strike, not reset on its second damage pulse', () => {
  const s=arena('mace',3); const spawn=spawner(s); const random=Math.random;
  try {
    Math.random=()=>.1; weaponOnCast(s,spawn);
    Math.random=()=>.7; weaponOnCast(s,spawn);
  } finally {Math.random=random;}
  const impacts=[...s.entities.values()].filter(e=>e.kind==='maceimpact');
  assert.notEqual(impacts[0].data?.rotation,impacts[1].data?.rotation);
  assert.equal(impacts[0].data?.r,90);
  const rotation=impacts[0].data?.rotation; impacts[0].ttl=.19; s.now+=.51;
  updateWeaponEntities(s,.01,{wrapDelta:(a,b)=>a-b,killEnemy:()=>{},spawn});
  assert.equal(impacts[0].data?.secondDone,1); assert.equal(impacts[0].data?.r,90);
  assert.equal(impacts[0].data?.rotation,rotation);
  assert.ok(impactLife(10.51,10.3,.4)>impactLife(10.52,10.3,.4));
});
