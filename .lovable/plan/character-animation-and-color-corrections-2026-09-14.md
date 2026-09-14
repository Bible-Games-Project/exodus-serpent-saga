# Character animation and color corrections

## Scope
- Change only the Shield Soldier, Spear Soldier, mounted soldier, Archer Chariot, and Armored Soldier details requested.
- Preserve enemy stats, movement, AI, cooldowns, progression, shield behavior, projectile behavior, and all unrelated artwork.

## Changes
1. **Shield Soldier**
   - Increase the rendered artwork scale from its current value by exactly 0.2%, without changing its collision radius or mechanics.
   - Apply a restrained warmer, slightly stronger color treatment consistently to its intact body and moving-leg layers.

2. **Spear Soldier**
   - Replace the faulty released frame with a corrected layer derived from the supplied PNG, removing only the held spear while preserving every head, face, hair, neck, torso, and clothing pixel.
   - Keep the existing held-spear, throw, separate projectile, and spear-return states.
   - Move only this soldier’s shadow slightly upward and keep it tied to the same ground position in every pose.

3. **Mounted soldier and Archer Chariot colors**
   - Apply the same restrained warm/color-definition adjustment to every body, leg, and wheel layer so the supplied artwork remains unchanged in shape and pixel style.
   - Keep the result pastel and harmonious rather than highly saturated.

4. **Mounted horse running animation**
   - Rebuild the derived layers from the supplied mounted PNG so the complete horse body remains in one uninterrupted layer.
   - Isolate only the actual legs for motion beneath that body, removing the current belly cut and seams while retaining current movement and charge timing.

5. **Armored Soldier attack**
   - Preserve the existing forward/downward body inclination.
   - Extend the weapon’s downward travel so its visible blade reaches Moses at the impact frame, then returns to rest.
   - Align the existing damage, impact, and blood feedback with that visible contact frame without changing damage, range, or cooldown.

## Verification
- Inspect idle, walking, turning, throwing, running, charging, blocking, and attacking frames in the Test Map.
- Confirm the Spear Soldier never loses head/body pixels and its separate projectile still returns correctly.
- Confirm the mounted horse has no belly seam or hole at any stride phase.
- Confirm the Armored Soldier’s visible weapon contact coincides with one existing damage event.
- Check normal play and Test Map for build, runtime, and visual regressions.

## Technical details
- All repaired animation layers will use pixels from the supplied artwork; no replacement character art will be generated.
- Color changes will be applied uniformly at Canvas render time, preserving source geometry and alpha.
- The Shield Soldier’s exact visual multiplier is `1.002`; gameplay collision remains unchanged as requested.