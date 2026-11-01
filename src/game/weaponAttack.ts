// Shared combat geometry and contact timeline; independent of shop presentation.
export const SPEAR_ATTACK = [
  { reach: 110, shaft: 70, cooldown: .7 },
  { reach: 155, shaft: 115, cooldown: .6 },
  { reach: 200, shaft: 160, cooldown: .5 },
] as const;
export const GROUND_IMPACT_DELAY = .3;
export const HARPOON_HAND_HIDE_SECONDS = .5;
export const AXE_FREEZE_SECONDS = .5;
export const BRANCH_COOLDOWN = [1, .49 / .55, .43 / .55] as const;
export const BRANCH_KNOCKBACK = [10, 38, 38] as const;
/** Rotate by the shortest path; a target switch settles rapidly, never snaps. */
export function turnWeaponAngle(current: number, target: number, dt: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-24 * dt));
}
export function heldHarpoonVisible(now: number, launchAt: number | undefined) {
  return launchAt == null || now < launchAt || now - launchAt >= HARPOON_HAND_HIDE_SECONDS;
}
export function spearAttack(evolution: number) {
  return SPEAR_ATTACK[evolution - 1] ?? SPEAR_ATTACK[0];
}
export function thrustPose(progress: number | null, angle: number, facing: number) {
  const p = Math.max(0, Math.min(1, progress ?? 0));
  const thrust = progress == null ? 0 : p < .2 ? -4 * p / .2 : p < .6 ? 16 * (p - .2) / .4 : 16 * (1 - p) / .4;
  // Body mirroring reflects the local rotation: solve from the world tip
  // direction instead of multiplying the world angle by facing.
  return { angle: Math.atan2(Math.cos(angle) * facing, -Math.sin(angle)), x: Math.cos(angle) * facing * thrust, y: Math.sin(angle) * thrust };
}
export function groundStrikeAngle(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  if (p < .25) return -.6 * p / .25;
  if (p < .6) return -.6 + 2.4 * ((p - .25) / .35) ** 2;
  return 1.8 * (1 - (p - .6) / .4);
}
export function impactLife(now: number, impactAt: number, duration: number) {
  return now < impactAt ? 0 : Math.max(0, 1 - (now - impactAt) / duration);
}