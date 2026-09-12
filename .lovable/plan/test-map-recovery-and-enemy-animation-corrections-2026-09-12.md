# Test Map Recovery and Enemy Animation Corrections

## Scope

Implement only the six requested corrections. Normal-game progression, damage, enemy behavior, and unrelated visuals remain unchanged.

## Changes

1. **Test Map recovery**
   - Centralize the player-defeat check so every damage source uses the same rule.
   - In Test Map sessions, reaching zero HP immediately restores Moses to full maximum HP while preserving the active match state.
   - In normal gameplay, retain the existing Game Over behavior unchanged.

2. **Archer Chariot**
   - Render the existing chariot at exactly twice its current visual scale and align its shadow, health bar, weapon release point, and collision radius with the larger sprite.
   - Preserve continuous movement, moving shots, contact damage, and all current combat values.
   - Build layered animation from the existing supplied chariot artwork: keep horses and carriage bodies intact, animate only isolated horse legs, and rotate isolated wheel layers in sync with movement.

3. **Spear Soldier held spear**
   - Track whether each Spear Soldier currently owns an active thrown spear.
   - Hide the held spear from the release frame until that projectile is removed by impact, expiration, or another existing removal path.
   - Restore the held spear only when the soldier is ready to possess it again; keep the supplied spear PNG as the projectile.
   - Raise the existing shadow to meet the visible feet throughout walking and throwing.

4. **Armored Soldier pastel adjustment**
   - Apply a subtle render-only lightening and desaturation of approximately 10%.
   - Preserve the supplied sprite, animation, size, behavior, and gameplay values.

5. **Wolf idle legs**
   - Give the waiting state a planted, vertical leg arrangement under the intact body.
   - Leave run and leap movement unchanged, with only a small pose transition if needed.

## Technical Notes

- Derive any chariot leg and wheel masks from the existing sprite asset; no body or belly cuts.
- Keep projectile ownership in existing entity data rather than introducing another attack system.
- Validate normal and Test Map death behavior separately, then visually inspect the chariot, Spear Soldier, Armored Soldier, and Wolf in the Test Map at desktop and mobile sizes.
