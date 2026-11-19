// Which library sound each game action plays.
//
// DEFAULT_SOUNDS are the game's own picks. The maintainer reassigns sounds in
// Test Map → Sound testing; those picks are saved in this browser
// (localStorage), override the defaults and are used by the game right away.
// "Copy choices" there gives the text to paste into DEFAULT_SOUNDS to make the
// picks permanent for every player. "" means silent.
import { soundPath, SOUND_EVENTS } from "./soundCatalog";

const S = "audio/Library/Synth/";
const ai = (id: string, n: number) => {
  const ev = SOUND_EVENTS.find((e) => e.id === id);
  return ev ? soundPath(ev, n) : "";
};

/** action id → library sound path (the game's defaults) */
export const DEFAULT_SOUNDS: Record<string, string> = {
  // Weapons: impacts only
  "weapon.staff.hit": `${S}hit-wood-knock.wav`,
  "weapon.spear.hit": `${S}hit-stab.wav`,
  "weapon.sword.hit": `${S}hit-slice.wav`,
  "weapon.sword.crit": ai("weapon.sword.crit", 2),
  "weapon.axe.impact": `${S}hit-heavy-thud.wav`,
  "weapon.mace.impact": ai("weapon.mace.impact", 4),
  "weapon.dagger.hit": `${S}hit-stab.wav`,
  "weapon.harpoon.hit": `${S}hit-punch.wav`,
  "weapon.harpoon.whirlpool": ai("weapon.harpoon.whirlpool", 1),
  "weapon.boomerang.hit": `${S}hit-thud.wav`,
  "weapon.boomerang.catch": `${S}hit-wood-knock.wav`,
  "weapon.ring.hit": `${S}hit-metal.wav`,
  "weapon.ring.ricochet": ai("weapon.ring.ricochet", 2),
  "weapon.ring.zap": ai("weapon.ring.zap", 2),
  "weapon.projectile.hit": `${S}hit-punch.wav`,
  "weapon.shield.block": ai("weapon.shield.block", 2),
  // Staff specials
  "magic.special.charge": ai("magic.special.charge", 1),
  "magic.special.burst": ai("magic.special.burst", 5),
  "magic.special.ring": ai("magic.special.ring", 1),
  "magic.special.shard": ai("magic.special.shard", 3),
  "magic.special.firering": ai("magic.special.firering", 4),
  "magic.special.tornado": ai("magic.special.tornado", 4),
  "magic.special.wave": ai("magic.special.wave", 4),
  "magic.special.light": ai("magic.special.light", 1),
  "magic.special.godhand": ai("magic.special.godhand", 1),
  // Plagues
  "plague.serpent.cast": ai("plague.serpent.cast", 4),
  "plague.serpent.hit": ai("plague.serpent.hit", 4),
  "plague.leprosy.cast": ai("plague.leprosy.cast", 2),
  "plague.blood.cast": ai("plague.blood.cast", 4),
  "plague.frogs.cast": ai("plague.frogs.cast", 4),
  "plague.frogs.hit": ai("plague.frogs.hit", 5),
  "plague.gnats.cast": ai("plague.gnats.cast", 4),
  "plague.flies.block": ai("plague.flies.block", 4),
  "plague.livestock.cast": ai("plague.livestock.cast", 4),
  "plague.boils.pop": ai("plague.boils.pop", 5),
  "plague.hail.impact": ai("plague.hail.impact", 4),
  "plague.fire.cast": ai("plague.fire.cast", 4),
  "plague.fire.explode": ai("plague.fire.explode", 5),
  "plague.locusts.cast": ai("plague.locusts.cast", 4),
  "plague.darkness.cast": ai("plague.darkness.cast", 2),
  "plague.firstborn.cast": ai("plague.firstborn.cast", 2),
  "plague.firstborn.strike": ai("plague.firstborn.strike", 2),
  "plague.redsea.slam": ai("plague.redsea.slam", 1),
  "plague.redsea.crash": ai("plague.redsea.crash", 4),
  "plague.pillar.cast": ai("plague.pillar.cast", 1),
  "plague.firepillar.cast": ai("plague.pillar.cast", 3),
  // Pickups and bonuses
  "pickup.xp": `${S}pickup-gem-chime.wav`,
  "pickup.magnet": `${S}power-magnet-hum.wav`,
  "pickup.bonus.appear": `${S}power-bonus-pop.wav`,
  "bonus.heart": `${S}power-heal-chord.wav`,
  "bonus.magnet": `${S}power-magic-rise.wav`,
  "bonus.star": `${S}power-star-fanfare.wav`,
  "bonus.lightning": `${S}power-speed-zip.wav`,
  "bonus.shield": `${S}power-shield-shimmer.wav`,
  // Enemies and boss
  "enemy.death.small": ai("enemy.death.small", 2),
  "enemy.death.medium": ai("enemy.death.medium", 2),
  "enemy.death.large": ai("enemy.death.large", 4),
  "enemy.death.elite": ai("enemy.death.elite", 4),
  "enemy.melee": ai("enemy.melee", 2),
  "enemy.arrow": ai("enemy.arrow", 1),
  "enemy.spear.throw": ai("enemy.spear.throw", 1),
  "enemy.mage.cast": ai("enemy.mage.cast", 3),
  "enemy.knight.charge": ai("enemy.knight.charge", 4),
  "enemy.agile.dash": ai("enemy.agile.dash", 2),
  "enemy.lion.roar": ai("enemy.lion.roar", 1),
  "enemy.wolf.howl": ai("enemy.wolf.howl", 1),
  "enemy.chariot.shoot": ai("enemy.chariot.shoot", 1),
  "boss.appear": ai("boss.appear", 4),
  "boss.wake": ai("boss.wake", 4),
  "boss.smash": ai("boss.smash", 4),
  "boss.leap": ai("boss.leap", 4),
  "boss.land": ai("boss.land", 4),
  "boss.spear": ai("boss.spear", 4),
  "boss.defeated": ai("boss.defeated", 4),
  "boss.revive": ai("boss.revive", 4),
  // Player
  "player.hurt": ai("player.hurt", 1),
  "player.shield.absorb": `${S}hit-metal.wav`,
  "player.helmet.block": `${S}ui-metal-clink.wav`,
  "player.death": ai("player.death", 1),
  "player.revive": ai("player.revive", 1),
  // Game events
  "event.levelup": ai("event.levelup", 2),
  "event.plague.unlock": ai("event.plague.unlock", 1),
  "event.plague.evolve": ai("event.plague.evolve", 2),
  "event.blessing": `${S}power-holy-chord.wav`,
  "event.champion.summon": ai("event.champion.summon", 5),
  "event.champion.down": ai("event.champion.down", 1),
  "event.champion.revive": ai("event.champion.revive", 2),
  "event.gameover": `${S}ui-hush.wav`,
  // UI
  "ui.hover": `${S}ui-soft-tick.wav`,
  "ui.click": `${S}ui-wood-click.wav`,
  "ui.confirm": `${S}ui-chime-up.wav`,
  "ui.back": `${S}ui-chime-down.wav`,
  "ui.menu.open": `${S}ui-scroll-open.wav`,
  "ui.menu.close": `${S}ui-scroll-close.wav`,
  "ui.tab": `${S}ui-paper-flick.wav`,
  "ui.pause": `${S}ui-pause-tones.wav`,
  "ui.resume": `${S}ui-resume-tones.wav`,
  "ui.toggle": `${S}ui-toggle-on.wav`,
  "ui.slider": `${S}ui-slider-tick.wav`,
  "ui.error": `${S}ui-soft-error.wav`,
  "ui.buy": `${S}ui-coin-chime.wav`,
  "ui.equip": `${S}ui-metal-clink.wav`,
  "ui.card": `${S}ui-card-flip.wav`,
};

const KEY = "exodus-survivors:sound-assignments";
const OLD_KEY = "exodus-survivors:sound-choices"; // earlier format: event id → option 1-5
export const CHOICES_EVENT = "exodus-survivors:sound-choices-changed";

let cache: Record<string, string> | null = null;

function local(): Record<string, string> {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Record<string, string> | null;
    if (!cache) {
      // Carry over picks made with the earlier five-option menu.
      const old = JSON.parse(window.localStorage.getItem(OLD_KEY) ?? "{}") as Record<string, number>;
      cache = {};
      for (const [id, n] of Object.entries(old)) if (typeof n === "number") cache[id] = ai(id, n);
    }
  } catch {
    cache = {};
  }
  return cache;
}

/** Sound path an action plays ("" or null = silent). */
export function assignedSound(id: string): string | null {
  const l = local();
  if (id in l) return l[id] || null;
  return DEFAULT_SOUNDS[id] || null;
}

/** "you" = assigned in Sound testing, "default" = the game's pick, null = silent. */
export function assignmentSource(id: string): "you" | "default" | null {
  const l = local();
  if (id in l) return "you";
  return DEFAULT_SOUNDS[id] ? "default" : null;
}

/** Effective assignments (defaults overridden by this browser's picks). */
export function allAssignments(): Record<string, string> {
  return { ...DEFAULT_SOUNDS, ...local() };
}

/** Assign a sound (path, "" = silent) or undefined to go back to the default. */
export function assignSound(id: string, path: string | undefined) {
  const next = { ...local() };
  if (path === undefined) delete next[id];
  else next[id] = path;
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHOICES_EVENT));
  }
}

/** This browser's own picks only. */
export function myAssignments(): Record<string, string> {
  return { ...local() };
}
