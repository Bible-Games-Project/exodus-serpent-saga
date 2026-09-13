# Enemy Sprite, Spawn, and Death-Effect Update

## Scope

Implement only the four requested changes. Enemy stats, damage, AI, spawn frequency, unlock progression, and attack timing stay unchanged.

## Changes

1. **Replace Spear Soldier artwork**
   - Use the newly supplied `Soldado_Lanza_V2.png` as the definitive visual source.
   - Derive body, released-spear, and lower-leg layers only from that image so walking remains animated without cutting the torso.
   - Keep the existing supplied flying-spear projectile and all current throw behavior.
   - Update the weapon release point and Test Map preview to match the new artwork.

2. **Replace mounted Spear Knight artwork**
   - Use `Caballero_Lanza_v2.png` as the definitive visual source.
   - Separate only the horse’s appropriate lower legs for walking and charging; preserve the horse belly, torso, rider, and spear as one intact body layer.
   - Preserve the existing movement, circling, pass-through charge, damage, and timing.

3. **Centralized off-screen enemy spawning**
   - Add one shared spawn-position helper based on the live logical camera width and height.
   - Choose a point beyond a randomly selected camera edge, adding the enemy’s full visual/collision extent plus a safety margin.
   - Use this rule for normal enemies, mounted enemies, chariots, Ramses, and future enemies entering through the shared spawn path.
   - Delay initial Ramses placement until the real viewport dimensions are known, keeping his throne aligned with him.

4. **Varied Canvas death effects**
   - Emit one short-lived death-effect entity exactly when a non-Ramses enemy is removed by death.
   - Randomize several subtle dust/smoke patterns, sizes, and trajectories.
   - Render the effect directly on the existing Canvas with small pixel rectangles and deterministic per-effect seeds.

## Validation

- Confirm both new sprites and their walking/throwing/charging states in the Test Map.
- Check new spawns on large desktop, smaller desktop, and mobile viewport sizes.
- Confirm enemies are fully off-screen at creation and enter naturally.
- Stress-check simultaneous kills for varied effects and stable performance.
- Verify normal gameplay balance values remain unchanged.
