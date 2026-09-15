# Agile and Mounted Soldier Update

## Scope
- Replace the Agile Soldier visual with the supplied PNG without redesigning it.
- Change only the Agile Soldier's movement into repeated short jumps with clear takeoff, airborne travel, and landing phases in varied directions.
- Preserve the Agile Soldier's existing combat behavior and damage.
- Replace the Mounted Soldier visual with the supplied PNG without redesigning it.
- Preserve the Mounted Soldier's charge, ramming, circling, timing, stats, and collision behavior.
- Animate the horse using separated leg regions at natural joints while keeping the rider, horse head, neck, chest, back, torso, and belly intact.
- Update Test Map previews to show the exact supplied artwork.

## Implementation
- Use the original Agile Soldier PNG as a single intact visual layer and move the full sprite vertically during jumps.
- Replace continuous run-in and retreat translation with short randomized jump cycles, including toward, sideways, and away directions; attacks remain planted and retain current timing.
- Use the original Mounted Soldier PNG as the source, with an intact body layer drawn above separate leg layers to conceal articulation joins.
- Keep all existing enemy definitions and cavalry logic unchanged.

## Validation
- Confirm both supplied sprites load in the Test Map.
- Observe multiple Agile Soldier jump directions and visible airborne arcs.
- Observe mounted walking and charging without belly cuts, torso seams, or disconnected body pixels.
- Confirm the app builds and runs without browser errors.
