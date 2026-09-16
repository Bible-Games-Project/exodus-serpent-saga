# Armored Soldier, Agile Soldier, and Snake Update

## Scope
- Repair only the Armored Soldier axe animation and subtly raise its shadow.
- Scale only the Agile Soldier artwork and matching collision area to exactly 3× their current values.
- Replace only Moses’ snake projectile with the supplied PNG, animate it in flight, and revise only its removal and shield-block behavior.

## Implementation
- Preserve the Armored Soldier’s intact torso, waist, hips, shoulders, and head; articulate only the attacking arm at its natural shoulder and elbow joints while retaining the current forward lean and impact timing.
- Keep the axe’s visual contact synchronized with the existing damage frame, and apply a small renderer-only upward shadow offset throughout idle and attack states.
- Multiply the Agile Soldier render scale and registry collision radius by exactly 3, leaving its jumping, stats, damage, and AI unchanged.
- Store the supplied snake PNG as the projectile source and render it as one intact image with lightweight traveling wave/bob/rotation motion so it appears alive throughout flight.
- Exempt snakes from arbitrary timer removal; remove them only after they are completely outside the current Moses-centered viewport or on shield contact.
- Match snake-versus-shield handling to the existing frog block: zero shield damage, no pass-through, immediate snake removal, and the existing shield impact effect.

## Validation
- Observe Armored Soldier idle and full attack cycles in both directions, checking joints, torso/hip integrity, shadow grounding, and axe contact timing.
- Confirm the Agile Soldier is exactly 3× larger with a correspondingly scaled hitbox and unchanged behavior.
- Confirm the new snake animates across the visible play area, survives while visible, disappears after fully leaving view, and is stopped harmlessly by a Shield Soldier.
- Confirm unrelated enemies, attacks, progression, and systems remain unchanged and the app runs without errors.
