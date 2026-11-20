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
  "weapon.staff.hit": "",
  "weapon.spear.hit": "",
  "weapon.sword.hit": "",
  "weapon.sword.crit": "",
  "weapon.axe.impact": "",
  "weapon.mace.impact": "",
  "weapon.dagger.hit": "",
  "weapon.harpoon.hit": "",
  "weapon.harpoon.whirlpool": "",
  "weapon.boomerang.hit": "",
  "weapon.boomerang.catch": "",
  "weapon.ring.hit": "",
  "weapon.ring.ricochet": "",
  "weapon.ring.zap": "",
  "weapon.projectile.hit": "",
  "weapon.shield.block": "",
  // Staff specials
  "magic.special.charge": "",
  "magic.special.burst": "",
  "magic.special.ring": "",
  "magic.special.shard": "",
  "magic.special.firering": "",
  "magic.special.tornado": "",
  "magic.special.wave": "",
  "magic.special.light": "",
  "magic.special.godhand": "",
  // Plagues
  "plague.serpent.cast": "",
  "plague.serpent.hit": "",
  "plague.leprosy.cast": "",
  "plague.blood.cast": "",
  "plague.frogs.cast": "",
  "plague.frogs.hit": "",
  "plague.gnats.cast": "",
  "plague.flies.block": "",
  "plague.livestock.cast": "",
  "plague.boils.pop": "",
  "plague.hail.impact": "",
  "plague.fire.cast": "",
  "plague.fire.explode": "",
  "plague.locusts.cast": "",
  "plague.darkness.cast": "",
  "plague.firstborn.cast": "",
  "plague.firstborn.strike": "",
  "plague.redsea.slam": "",
  "plague.redsea.crash": "",
  "plague.pillar.cast": "",
  "plague.firepillar.cast": "",
  // Pickups and bonuses
  "pickup.xp": "audio/Library/Synth/pickup-twinkle.wav",
  "pickup.magnet": `${S}power-magnet-hum.wav`,
  "pickup.bonus.appear": "",
  "bonus.heart": "audio/Bonuses/bonus-star-4.mp3",
  "bonus.magnet": "audio/Bonuses/bonus-star-4.mp3",
  "bonus.star": "audio/Bonuses/bonus-star-4.mp3",
  "bonus.lightning": "audio/Bonuses/bonus-star-4.mp3",
  "bonus.shield": "audio/Bonuses/bonus-star-4.mp3",
  // Enemies and boss
  "enemy.death.small": ai("enemy.death.small", 2),
  "enemy.death.medium": ai("enemy.death.small", 2),
  "enemy.death.large": ai("enemy.death.small", 2),
  "enemy.death.elite": ai("enemy.death.small", 2),
  "enemy.melee": "",
  "enemy.arrow": "",
  "enemy.spear.throw": "",
  "enemy.mage.cast": "",
  "enemy.knight.charge": "",
  "enemy.agile.dash": "",
  "enemy.lion.roar": "",
  "enemy.wolf.howl": "",
  "enemy.chariot.shoot": "",
  "boss.appear": "",
  "boss.wake": "",
  "boss.smash": "",
  "boss.leap": "",
  "boss.land": "",
  "boss.spear": "",
  "boss.defeated": "",
  "boss.revive": "",
  // Player
  "player.hurt": "",
  "player.shield.absorb": "",
  "player.helmet.block": "",
  "player.death": "",
  "player.revive": "",
  // Game events
  "event.levelup": "",
  "event.plague.unlock": "",
  "event.plague.evolve": "",
  "event.blessing": "",
  "event.champion.summon": "",
  "event.champion.down": "",
  "event.champion.revive": "",
  "event.gameover": ai("event.champion.revive", 2),
  // UI
  "ui.hover": "",
  "ui.click": "audio/Library/Synth/ui-wood-click.wav",
  "ui.confirm": `${S}ui-chime-up.wav`,
  "ui.back": `${S}ui-chime-down.wav`,
  "ui.menu.open": "",
  "ui.menu.close": "",
  "ui.tab": "",
  "ui.pause": `${S}ui-pause-tones.wav`,
  "ui.resume": `${S}ui-resume-tones.wav`,
  "ui.toggle": `${S}ui-toggle-on.wav`,
  "ui.slider": `${S}ui-slider-tick.wav`,
  "ui.error": `${S}ui-soft-error.wav`,
  "ui.buy": `${S}ui-coin-chime.wav`,
  "ui.equip": "audio/Library/Synth/ui-double-tick.wav",
  "ui.card": "audio/Bonuses/bonus-star-3.mp3",
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
