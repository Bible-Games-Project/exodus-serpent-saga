# src/game notes

- Champions holding a weapon (e.g. Miriam) use `weapon` layers in `allies.ts` (body / whole weapon / grip-hand overlay): the walk only steps the body's feet band and the weapon rotates intact around its grip, so it is never sliced. Test Map champion toggles are generated from `ALLY_POOL` and recruit through `summonCompanion`.
- The Agile Soldier special dash is a committed state in `enemyTick` that returns early (direction locked at start, fixed travel distance past Moses); hitting Moses only applies damage/FX. Any branch that falls through to the hop logic while dashing re-aims at Moses and makes him look stuck.
- Moses has two visual versions switched by `MOSES_VISUAL_VERSION` in `game/mosesGameArt.ts` ("original" keeps the old sprite/staff/animation; "new" uses the `moses-v2-*` layers). Gameplay reads only `MOSES_ART`/`MOSES_ATTACK`, so switching never affects combat.
- Champions retreat between attacks via `allyRetreatDir` (inverse-distance threat vector, obstacle-probed headings) recomputed with the target every `ALLY_RETARGET_SECONDS`.
- Moses v2 free arm is split at runtime (`freeArmLayers`); adjust `ARM` if body art changes.
- Flies are a projectile shield (`syncOrbitFlies` removes `enemyOwned` projectiles, no damage). Boils = `boilstrail` emitter dropping one-shot `boilbubble`s; Livestock targets `LIVESTOCK_TARGET_KINDS`; hazards with `bleedOnce` show blood once per enemy.
