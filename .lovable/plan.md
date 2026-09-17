# Snake and Soldier Visual Corrections

## Scope
- Rework only Moses’ thrown-snake presentation: a subtle pixelated S-shaped ground shadow, correct horizontal facing, and artwork scaled to 75%.
- Correct only the Armored Soldier’s attacking forearm separation so the elbow is the sole pivot, preserving the current body lean, pose, timing, and combat behavior.
- Repair only the Basic Egyptian Soldier’s staff artwork so it remains visually continuous throughout its existing swing.

## Implementation
- Draw the snake shadow from small stepped pixel blocks following a shallow animated S curve beneath the projectile; keep it aligned with the snake and low-opacity.
- Preserve the right-facing snake rendering, mirror the complete animated artwork horizontally for leftward travel, and reduce both displayed dimensions by exactly 25% without changing speed, range, collision, damage, or lifetime rules.
- Rebuild the Armored Soldier arm layers from the existing supplied artwork at a clean elbow boundary with enough overlap to prevent seams; keep the upper arm attached to the body and rotate the connected forearm-and-axe layer around the elbow using the existing attack motion and full-body lean.
- Repair the Basic Egyptian Soldier attack layer so the full staff is carried by one rigid rotating layer, while preserving the existing body animation, swing angles, timing, and damage.

## Validation
- Observe snakes moving left and right: verify correct facing, exact 75% visual size, continued slither animation, and a subtle pixelated S-shaped shadow.
- Observe the Armored Soldier’s full attack in both directions: verify unchanged lean and timing, with an intact shoulder/upper arm and gap-free elbow-driven forearm-and-axe swing.
- Observe the Basic Egyptian Soldier’s full attack in both directions: verify the staff remains continuous from end to end with unchanged movement and timing.
- Confirm the app runs without errors and unrelated gameplay remains unchanged.
