# Focused enemy animation and impact corrections

## Scope
Change only the Mage animation/impact presentation, Spear Soldier layer composition, Agile Soldier dust/dash completion, and Heavy Soldier successful-hit feedback. Preserve all sprites, stats, damage, progression, attack timing, projectile behavior, and unrelated systems.

## Implementation

### Mage
- Replace the global fast walk phase with a Mage-only phase that advances only while the Mage actually moves, at a slow deliberate cadence tied to elapsed movement time; reset to the existing idle pose whenever movement stops or casting begins.
- Keep the existing foot cycle and Mage movement speed unchanged.
- Scale the existing staff-palette pixel smoke burst to approximately twice its current spread and particle size while retaining its short lifetime and blood-free appearance.

### Spear Soldier
- Correct the supplied leg-layer composition so both complete legs remain covered and connected through the full stride, while the hips and torso remain intact.
- At release, compose the character from the intact supplied body layers and remove only the held spear layer/region. Do not use a release image that drops the head or face.
- Preserve the dedicated supplied flying-spear projectile, hand/weapon origin, trajectory rotation, collision, damage, and separation from Archer arrows.

### Agile Soldier
- Scale the existing monochrome desert dust geometry to approximately twice its current size without changing its timing, color, opacity, or spawn behavior.
- Keep the randomized 15–20 completed-jump trigger. At dash start, lock `normalize(MosesPosition - SoldierPosition)` once and calculate the remaining distance along that ray to the far boundary of the 8192×8192 world.
- Continue direct visible movement along that unchanged vector after the swept Moses contact. Damage and slash trigger once without stopping movement; transition back to normal jumps only near the far boundary, then reset the randomized cycle.

### Heavy Soldier
- On the existing first successful axe-contact frame, add one Heavy Soldier-only large directional pixel slash at the calculated Moses contact point.
- Use restrained red/dark-red cut shapes with a short lifetime and no realistic blood spray. Preserve the existing axe animation, contact window, damage, and collision.

## Validation
- Test each requested enemy independently in the Test Map.
- Confirm Mage slow stepping stops at idle/cast and the larger magic smoke remains localized.
- Confirm Spear Soldier legs, head, face, and body remain complete through walking and throwing, with only the held spear hidden after release.
- Confirm Agile dust is visibly doubled and the special dash crosses Moses once, continues uninterrupted to the far world boundary, then resumes hopping.
- Confirm the Heavy Soldier slash appears once at axe contact without changing damage or animation.
- Check runtime/console errors and the final preview build signal.
