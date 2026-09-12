# Enemy visual and shield corrections

## Scope
- Keep all unrelated enemies, progression, attacks, cooldowns, and systems unchanged.
- Preserve the horse knight’s current charge and roaming logic.
- Use both supplied PNGs as the definitive Armored Soldier and Spear Soldier artwork.

## Changes
1. **Horse knight**
   - Double its rendered size and scale its collision/contact range to match.
   - Rework only the layered animation: keep the complete horse/rider torso as one intact layer and animate legs beneath it, with separate walk and charge stride timing.

2. **Lion**
   - Replace the irregular stalk/burst logic with the Dog’s chase, stopping distance, and pounce rhythm.
   - Set HP and damage to exactly 3× the Dog’s values, without increasing speed beyond the Dog reference.
   - Increase the current lion rendering and matching hit area by 50%, keeping its body intact while the legs animate underneath.

3. **Agile Soldier**
   - Darken the existing artwork without changing its design.
   - Render it at exactly half its current size and align its hit area and attack reach with the smaller body.

4. **Armored Soldier and Spear Soldier artwork**
   - Import the supplied PNGs through the project asset system.
   - Build animation layers from those exact pixels, keeping each torso/body intact and moving only legs or the weapon-bearing limb where needed.
   - Preserve the Armored Soldier’s existing gameplay and the Spear Soldier’s movement pause, throw timing, separate supplied spear projectile, and weapon-tip release point.
   - Update Test Map previews to show the replacement visuals.

5. **Shield Soldier interception**
   - Make snakes disappear on shield contact with zero shield damage, the existing block effect, and no pass-through damage.
   - Make a physical staff swing stop at the first Shield Soldier it reaches, consuming that individual swing so enemies behind receive no damage.
   - Apply the same consumed-on-block rule to frogs and other shield-blocked projectiles while preserving the current shield sound and visual feedback.

## Verification
- Check normal and Test Map rendering for intact bodies, correct scales, animation, and aligned hit areas.
- Exercise snake, frog, and staff attacks against a Shield Soldier with enemies behind it.
- Confirm the existing horse charge/roaming and Spear Soldier throw mechanics remain unchanged and the app reports no build or runtime errors.

## Technical details
- Derived animation layers will contain only pixels from the supplied PNGs; no replacement artwork will be generated.
- Collision radii and weapon release coordinates will be updated alongside visual scaling so contact remains visually accurate.
