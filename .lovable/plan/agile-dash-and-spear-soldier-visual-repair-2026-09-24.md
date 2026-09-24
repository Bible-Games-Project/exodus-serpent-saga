# Agile Dash and Spear Soldier Visual Repair

## Scope
- Fix only the Agile Soldier’s special dash and the Spear Soldier’s rendering/animation.
- Preserve all movement speeds, damage, attack timing, range, AI selection, progression, and projectile collision.

## Changes
1. **Agile Soldier dash-through state**
   - Lock the normalized attack direction once when the special dash begins.
   - Track distance traveled and whether Moses has been crossed independently from collision feedback.
   - Keep applying movement after the one-time swept hit; end only beyond Moses at a safe far distance or world-edge distance.
   - Clear the dash state and start a fresh randomized 15–20 jump cycle only at that endpoint.

2. **Spear Soldier visual layers**
   - Produce a spear-free intact character layer from the latest supplied artwork, preserving the head, face, hands, clothing, and body.
   - Render the held spear as its own attached layer before release, then hide that entire layer at release.
   - Keep the existing supplied flying-spear image, hand-origin spawn, trajectory rotation, timing, damage, and collision.

3. **Walking animation**
   - Recompose the supplied leg artwork around natural hip pivots with protected overlap under the intact clothing.
   - Use a restrained alternating stride, slight foot lift, and subtle opposite body/arm counter-motion without cutting the torso or leaving gaps.

## Verification
- Run the Agile Soldier long enough to trigger its special attack and confirm it crosses Moses, continues away, and resets normally.
- Watch the Spear Soldier walk for several cycles and confirm complete legs and intact body in every phase.
- Trigger repeated throws and confirm the complete held spear disappears, the body remains intact, and only the supplied spear projectile flies.
- Check the focused flow at desktop and the current mobile-sized viewport, plus build/runtime diagnostics.
