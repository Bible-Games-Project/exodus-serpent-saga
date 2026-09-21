# Mage, Agile Soldier, and Spear Soldier corrections

## Scope
Change only the Egyptian Sorcerer, Agile Soldier, and Spear Soldier paths. Preserve all other enemies, progression, damage values, projectiles, and gameplay systems.

## Implementation

### Egyptian Sorcerer
- Reduce only the Mage registry movement speed to exactly one third of its current value (`current × 0.3333`).
- Keep the existing cast timing and projectile behavior, while ensuring the ranged movement path remains fully planted for the complete casting hold.
- Strengthen the existing supplied-sprite walking cycle so the two feet visibly alternate forward/backward from their natural lower-body joints. Keep the robe, hips, torso, head, arms, and staff intact, stop the cycle at idle, and suppress it during casting.
- On a successful Mage magic-ball collision only, replace the generic hit spark and blood burst with a compact, short-lived pixel-art magical smoke burst at the swept collision point. Keep damage, collision, movement, and projectile removal unchanged.

### Agile Soldier
- Extend the existing random-hop state rather than replacing it. Count completed normal jumps and select a fresh random threshold from 15 through 20 for every cycle.
- At the threshold, lock one direction toward Moses and run a visible high-speed straight pass through his current position, then continue along that same line until the Soldier is clearly beyond him and at a safe separation.
- Apply the existing 12-point contact/melee damage exactly once when the swept dash path crosses Moses. Spawn a compact pixel-art slash at the calculated contact point, then reset the counter and resume ordinary random jumps.
- Add lightweight desert-colored pixel dust at every normal jump takeoff and landing. Use short-lived Canvas particles and keep the sprite unobscured.

### Spear Soldier
- Repair the artwork readiness/render path so the character is never withheld because a secondary release or projectile image is still loading or invalid. Idle/walk should draw from the latest supplied body and leg PNGs; the release frame should use its supplied body image independently.
- Correct the release image asset reference to its immutable hosted file rather than the source-development path currently stored in its pointer.
- Preserve the dedicated `spear_e` projectile kind, supplied flying-spear PNG, trajectory rotation, current damage, swept player collision, and immediate removal on hit. Keep Archer arrows isolated to `arrow`.
- Keep the held spear visible until release, hide it while that projectile is in flight, and restore it when the projectile is removed or expires. Keep the muzzle tied to the Spear Soldier's weapon position.

## Validation
- Use the separate Test Map with only one requested enemy enabled at a time.
- Confirm Mage foot alternation while moving, complete stillness while casting, one-third movement speed, and smoke-only magic-ball impacts.
- Confirm Agile random jumps, dust on takeoff/landing, randomized 15–20 cycle, visible pass-through dash, one damage event, slash contact effect, safe exit, and return to hopping.
- Confirm Spear Soldier visibility during idle, walking, wind-up, release, and recovery; verify supplied spear rendering from the weapon, correct rotation, hit removal, and no Archer arrow substitution.
- Check desktop and mobile framing, runtime/console errors, and the final preview build signal.
