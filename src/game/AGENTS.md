# src/game notes

- Champions holding a weapon (e.g. Miriam) use `weapon` layers in `allies.ts` (body / whole weapon / grip-hand overlay): the walk only steps the body's feet band and the weapon rotates intact around its grip, so it is never sliced. Test Map champion toggles are generated from `ALLY_POOL` and recruit through `summonCompanion`.
- The Agile Soldier special dash is a committed state in `enemyTick` that returns early (direction locked at start, fixed travel distance past Moses); hitting Moses only applies damage/FX. Any branch that falls through to the hop logic while dashing re-aims at Moses and makes him look stuck.
- Moses has two visual versions switched by `MOSES_VISUAL_VERSION` in `game/mosesGameArt.ts` ("original" keeps the old sprite/staff/animation; "new" uses the `moses-v2-*` layers). Gameplay reads only `MOSES_ART`/`MOSES_ATTACK`, so switching never affects combat.
- Champions retreat between attacks via `allyRetreatDir` (inverse-distance threat vector, obstacle-probed headings) recomputed with the target every `ALLY_RETARGET_SECONDS`.
- Moses v2 free arm is split at runtime (`freeArmLayers`); adjust `ARM` if body art changes.
- Flies are a projectile shield (`syncOrbitFlies` removes `enemyOwned` projectiles, no damage). Boils = `boilstrail` emitter dropping one-shot `boilbubble`s; Livestock targets `LIVESTOCK_TARGET_KINDS`; hazards with `bleedOnce` show blood once per enemy.
- Hail alternates ice/fire via `state.hailFirePhase` (toggled only on the main cast; multi-attack repeats reuse it); "fire" stays in `PLAGUES` but is not in `PLAGUE_ORDER`. Reworked plague visuals live in `plagueFx.ts`.
- Red Sea casts through `state.redSeaCast` (raise → strike → walls); staff attacks wait via `redSeaCasting`. Its center burst runs on a `redseatimer` hazard (game time), never `setTimeout`.
- Pillar of Cloud cages via enemy `data.cage*` clamped after all movement; Pillar of Fire burns via `burnUntil`/`burnZone` (single damage source per zone).
- Ramses art switches: `RAMSES_VISUAL_VERSION` (ramsesArt.ts: v2 walk + seated-with-throne; procedural throne hidden while he sits) and `RAMSES_CHARIOT_VERSION` (ramsesChariotArt.ts). Old assets stay for rollback; never delete them.
- Route refreshes (enemy target choice, champion target + retreat heading, wolf pack centre) go through `routing.ts` (`ROUTE_MIN_INTERVAL` 0.4 s per character); per-frame steering toward the cached target is not a refresh.
- Firstborn branches start at the Angel of Light's sword (`angelArt.ts`, `firstbornangel` visual hazard anchored at cast). Livestock is a camera-following `livestockwave` band.
- Supplied champions use virtual sprite coordinates and original-pixel arm/weapon layers; draw full-resolution sources into those coordinates without changing their proportions.
- Champion projectile simulation stays on the ground; hand height is a visual lift only, keeping collision aligned with enemy ground positions.
- Support timelines run without hostile targets; verify healing and wards in an empty arena as well as in combat.
