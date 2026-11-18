// Every sound event (action) in the game, with its playback rules.
//
// Any sound of the library (soundLibrary.ts) can be assigned to any action in
// Test Map → Sound testing (soundChoices.ts). Most events also have five
// ElevenLabs alternatives (scripts/generate-sounds.ts) stored in
// public/audio/<folder>/<id>-<n>.mp3; those files are part of the library.

export const ALTERNATIVES = 5;

export type SoundCategory = "weapons" | "magic" | "pickups" | "bonuses" | "enemies" | "player" | "events" | "ui";

export const SOUND_CATEGORIES: Array<{ id: SoundCategory; label: string }> = [
  { id: "weapons", label: "Weapons" },
  { id: "magic", label: "Magic and Plagues" },
  { id: "pickups", label: "Coins and Pickups" },
  { id: "bonuses", label: "Bonuses" },
  { id: "enemies", label: "Enemies" },
  { id: "player", label: "Player" },
  { id: "events", label: "Game Events" },
  { id: "ui", label: "UI" },
];

export type SoundEvent = {
  id: string;
  category: SoundCategory;
  /** folder under public/audio */
  folder: string;
  label: string;
  /** what the sound is, for the generator */
  prompt: string;
  /** five style directions, one per alternative, so the five really differ */
  takes: string[];
  /** generated length in seconds (0.5-3) */
  duration: number;
  /** 1 = most important (player damage) … 8 = least (UI hover) */
  priority: number;
  /** max simultaneous plays of this event (or its group) */
  maxVoices: number;
  /** minimum seconds between two plays of this event (or its group) */
  cooldown: number;
  /** random pitch variation, ± fraction */
  pitchVar: number;
  /** base volume 0-1 */
  volume: number;
  /** events sharing a group share voices and cooldown (e.g. enemy deaths) */
  group?: string;
  /** when at the voice cap, cut the oldest instead of skipping the new one */
  restart?: boolean;
  /** consecutive plays within 0.5 s rise in pitch (pickup streaks) */
  streak?: boolean;
  /** no longer played by the game; its generated files stay in the library */
  retired?: boolean;
  /** action without generated files of its own (library sounds only) */
  noFiles?: boolean;
};

// Style directions per kind of sound: five clearly different takes.
const ACTION_TAKES = [
  "realistic and organic, close natural recording, dry",
  "punchy stylized arcade game sound, crisp and snappy",
  "with an ancient mystical shimmer, desert reverb",
  "deep, heavy and bassy, cinematic weight",
  "light, bright and playful cartoon style",
];
const MAGIC_TAKES = [
  "ancient biblical miracle, choir-like shimmer and reverb",
  "dark, ominous and rumbling, cinematic",
  "bright crystalline magic sparkles, fantasy game",
  "organic and earthy, natural textures, realistic",
  "stylized retro arcade magic, punchy and short",
];
const PICKUP_TAKES = [
  "soft glassy chime, pleasant",
  "bright sparkling coin-like ding",
  "warm wooden marimba blip",
  "retro 8-bit arcade blip",
  "magical twinkle with a little airy shimmer",
];
const UI_TAKES = [
  "soft wooden click, subtle",
  "bright gentle chime",
  "papery parchment texture",
  "retro 8-bit blip",
  "warm muted pluck",
];
const JINGLE_TAKES = [
  "orchestral fanfare with harp and strings, ancient Middle Eastern flavor",
  "short choir and bell flourish, sacred and uplifting",
  "oud and frame drum flourish, desert mood",
  "bright arcade game jingle, upbeat",
  "cinematic brass and timpani hit, epic",
];

type Def = Omit<SoundEvent, "category" | "folder" | "takes" | "pitchVar" | "volume" | "maxVoices" | "cooldown" | "priority"> &
  Partial<Pick<SoundEvent, "takes" | "pitchVar" | "volume" | "maxVoices" | "cooldown" | "priority">>;

function group(category: SoundCategory, folder: string, takes: string[], defaults: Partial<SoundEvent>, defs: Def[]): SoundEvent[] {
  return defs.map((d) => ({ pitchVar: 0.06, volume: 0.8, maxVoices: 2, cooldown: 0.05, ...defaults, takes, category, folder, ...d }) as SoundEvent);
}

export const SOUND_EVENTS: SoundEvent[] = [
  // ---------------- Weapons ----------------
  ...group("weapons", "Player/Weapons", ACTION_TAKES, { priority: 2 }, [
    // Only impacts: swings, thrusts and throws are silent (the maintainer's call).
    { id: "weapon.staff.hit", label: "Staff hits an enemy", prompt: "Wooden staff striking a body, blunt thud impact", duration: 0.5, priority: 7, group: "hit", maxVoices: 3, cooldown: 0.06, volume: 0.5 },
    { id: "weapon.spear.hit", label: "Spear hits an enemy", prompt: "", duration: 0.5, priority: 7, group: "hit", maxVoices: 3, cooldown: 0.06, volume: 0.5, noFiles: true },
    { id: "weapon.sword.hit", label: "Sword hits an enemy", prompt: "", duration: 0.5, priority: 7, group: "hit", maxVoices: 3, cooldown: 0.06, volume: 0.5, noFiles: true },
    { id: "weapon.sword.crit", label: "Sword critical hit", prompt: "Critical sword hit, sharp metallic slice with a satisfying ring", duration: 0.6, cooldown: 0.12 },
    { id: "weapon.axe.impact", label: "Axe hits the ground", prompt: "", duration: 0.7, volume: 0.7, noFiles: true },
    { id: "weapon.mace.impact", label: "Mace hits the ground", prompt: "Heavy mace slamming the ground, crushing thump with debris", duration: 0.7, volume: 0.75 },
    { id: "weapon.dagger.hit", label: "Dagger hits an enemy", prompt: "", duration: 0.5, priority: 7, group: "hit", maxVoices: 3, cooldown: 0.06, volume: 0.5, noFiles: true },
    { id: "weapon.harpoon.hit", label: "Harpoon hits an enemy", prompt: "", duration: 0.5, priority: 7, group: "hit", maxVoices: 3, cooldown: 0.06, volume: 0.55, noFiles: true },
    { id: "weapon.harpoon.whirlpool", label: "Harpoon whirlpool", prompt: "Swirling water whirlpool forming, splashing vortex", duration: 1.2, cooldown: 0.3 },
    { id: "weapon.boomerang.hit", label: "Boomerang hits an enemy", prompt: "", duration: 0.5, priority: 7, group: "hit", maxVoices: 3, cooldown: 0.06, volume: 0.5, noFiles: true },
    { id: "weapon.boomerang.catch", label: "Boomerang caught", prompt: "Wooden boomerang caught in hand, soft slap", duration: 0.5, volume: 0.5 },
    { id: "weapon.ring.hit", label: "Ring hits an enemy", prompt: "", duration: 0.5, priority: 7, group: "hit", maxVoices: 3, cooldown: 0.06, volume: 0.5, noFiles: true },
    { id: "weapon.ring.ricochet", label: "Ring ricochet", prompt: "Metal ring ricocheting off a target, bright ping", duration: 0.5, maxVoices: 2, cooldown: 0.08, volume: 0.5 },
    { id: "weapon.ring.zap", label: "Ring lightning zap", prompt: "Short electric lightning zap, crackle", duration: 0.5, cooldown: 0.1, volume: 0.55 },
    { id: "weapon.projectile.hit", label: "Fire staff bolt hits", prompt: "Thrown blade hitting a body, short stab impact", duration: 0.5, priority: 7, group: "hit", maxVoices: 3, cooldown: 0.06, volume: 0.5 },
    { id: "weapon.shield.block", label: "Weapon hits a shield", prompt: "Weapon clanging off a metal shield, metallic clank", duration: 0.5, maxVoices: 2, cooldown: 0.06, volume: 0.55 },
    // Retired (not played): kept so their files stay in the library.
    { id: "weapon.staff.swing", label: "Staff swing", prompt: "Wooden shepherd's staff swung fast through the air, whoosh", duration: 0.5, retired: true },
    { id: "weapon.spear.thrust", label: "Spear thrust", prompt: "Spear thrust forward, quick piercing swoosh with a metal tip", duration: 0.5, retired: true },
    { id: "weapon.sword.slash", label: "Sword slash", prompt: "Bronze sword slash through the air, sharp blade swish", duration: 0.5, retired: true },
    { id: "weapon.dagger.throw", label: "Dagger throw", prompt: "Small dagger thrown, fast spinning whistle", duration: 0.5, retired: true },
    { id: "weapon.harpoon.throw", label: "Harpoon throw", prompt: "Harpoon launched with a rope trailing, whooshing throw", duration: 0.6, retired: true },
    { id: "weapon.boomerang.throw", label: "Boomerang throw", prompt: "Wooden boomerang spinning through the air, rhythmic whirring", duration: 0.8, retired: true },
    { id: "weapon.ring.throw", label: "Ring throw", prompt: "Metal ring thrown, spinning metallic hum", duration: 0.6, retired: true },
    { id: "weapon.axe.cut", label: "Axe ground cut", prompt: "Heavy axe chopping into the ground, cracking earth line", duration: 0.7, retired: true },
    { id: "weapon.branch.gust", label: "Branch wind gust", prompt: "Leafy branch swung creating a strong gust of wind, rustling leaves", duration: 0.7, retired: true },
  ]),

  // ---------------- Magic: staff specials ----------------
  ...group("magic", "Player/Magic", MAGIC_TAKES, { priority: 3, cooldown: 0.2, volume: 0.8 }, [
    { id: "magic.special.charge", label: "Staff special charging", prompt: "Magical energy gathering into a staff, rising hum", duration: 1.2 },
    { id: "magic.special.burst", label: "Special: burst", prompt: "Magic energy burst exploding outward from a staff", duration: 0.9 },
    { id: "magic.special.ring", label: "Special: ring", prompt: "Expanding magic ring shockwave, resonant whoom", duration: 1.0 },
    { id: "magic.special.shard", label: "Special: shards", prompt: "Crystal shards launched in a spray, glassy whooshes", duration: 0.9 },
    { id: "magic.special.firering", label: "Special: ring of fire", prompt: "Ring of fire igniting around the caster, roaring flames", duration: 1.2 },
    { id: "magic.special.tornado", label: "Special: tornado", prompt: "Small sand tornado spinning up, howling wind", duration: 1.5 },
    { id: "magic.special.wave", label: "Special: wave", prompt: "Wave of water surging forward, rushing splash", duration: 1.2 },
    { id: "magic.special.light", label: "Special: divine light", prompt: "Beam of divine holy light, heavenly shimmer", duration: 1.2 },
    { id: "magic.special.godhand", label: "Special: hand of God", prompt: "Enormous divine hand slamming down from the sky, holy impact boom", duration: 1.3 },
  ]),

  // ---------------- Magic: plagues ----------------
  ...group("magic", "Player/Plagues", MAGIC_TAKES, { priority: 3, cooldown: 0.15, volume: 0.8 }, [
    { id: "plague.serpent.cast", label: "Staff becomes serpent", prompt: "Wooden staff thrown down transforming into a hissing snake", duration: 0.9 },
    { id: "plague.serpent.hit", label: "Serpent bites", prompt: "Snake bite strike with a short hiss", duration: 0.5, priority: 6, maxVoices: 2, cooldown: 0.1, volume: 0.6 },
    { id: "plague.leprosy.cast", label: "White leprosy", prompt: "Eerie pale magical curse, cold whispering shimmer", duration: 1.0 },
    { id: "plague.blood.cast", label: "Water into blood", prompt: "Pool of thick blood erupting from the ground, gurgling liquid splash", duration: 1.0 },
    { id: "plague.frogs.cast", label: "Frogs released", prompt: "Group of frogs croaking and hopping out", duration: 0.8 },
    { id: "plague.frogs.hit", label: "Frog lands on a foe", prompt: "Frog landing with a wet splat", duration: 0.5, priority: 6, maxVoices: 2, cooldown: 0.1, volume: 0.55 },
    { id: "plague.gnats.cast", label: "Gnats swarm", prompt: "Swarm of tiny gnats buzzing, high pitched", duration: 1.2 },
    { id: "plague.flies.block", label: "Flies stop a projectile", prompt: "Buzzing flies swarming and swallowing an arrow, short buzz burst", duration: 0.5, maxVoices: 2, cooldown: 0.12, volume: 0.6 },
    { id: "plague.livestock.cast", label: "Livestock stampede", prompt: "Herd of cattle stampeding, hooves thundering and mooing", duration: 1.5 },
    { id: "plague.boils.pop", label: "Boils pop", prompt: "Bubbling boil popping, wet squelchy pop", duration: 0.5, priority: 6, maxVoices: 2, cooldown: 0.08, volume: 0.6 },
    { id: "plague.hail.impact", label: "Hailstone lands", prompt: "Big hailstone smashing into the ground, icy crack", duration: 0.6, priority: 6, maxVoices: 3, cooldown: 0.06, volume: 0.6 },
    { id: "plague.fire.cast", label: "Fireball falls", prompt: "Fireball falling from the sky, whooshing flame", duration: 0.8, maxVoices: 2 },
    { id: "plague.fire.explode", label: "Fireball explodes", prompt: "Fireball explosion, fiery blast", duration: 0.9, maxVoices: 2, cooldown: 0.1 },
    { id: "plague.locusts.cast", label: "Locust swarm", prompt: "Huge swarm of locusts flying past, dense rattling wings", duration: 1.6 },
    { id: "plague.darkness.cast", label: "Darkness falls", prompt: "Darkness descending, deep ominous drone and wind", duration: 2.0 },
    { id: "plague.firstborn.cast", label: "Angel of death appears", prompt: "Angel of death descending, ethereal choir and rushing wings", duration: 1.6 },
    { id: "plague.firstborn.strike", label: "Angel's bolt strikes", prompt: "Holy lightning bolt strike from above, sharp crack", duration: 0.7, maxVoices: 2, cooldown: 0.1 },
    { id: "plague.redsea.slam", label: "Red Sea: staff slam", prompt: "Staff slammed on the ground with a mighty echoing boom", duration: 1.0, priority: 2 },
    { id: "plague.redsea.crash", label: "Red Sea: walls crash", prompt: "Giant walls of sea water crashing down, roaring flood", duration: 2.0, priority: 2 },
    { id: "plague.pillar.cast", label: "Pillar of cloud and fire", prompt: "Towering pillar of cloud and fire rising, rumbling whoosh", duration: 1.5 },
  ]),

  // ---------------- Pickups ----------------
  ...group("pickups", "Pickups", PICKUP_TAKES, { priority: 5, pitchVar: 0.03, volume: 0.45 }, [
    { id: "pickup.xp", label: "Experience gem collected", prompt: "Tiny gem collected, short pickup sound", duration: 0.5, maxVoices: 2, cooldown: 0.07, streak: true },
    { id: "pickup.magnet", label: "Pickups pulled in (magnet)", prompt: "Many small items being pulled in by a magnet, rising whoosh", duration: 0.8, cooldown: 0.8, maxVoices: 1 },
    { id: "pickup.bonus.appear", label: "A bonus appears on the map", prompt: "Something special appearing, soft magical pop", duration: 0.6, cooldown: 0.5, volume: 0.5 },
  ]),

  // ---------------- Bonuses ----------------
  ...group("bonuses", "Bonuses", PICKUP_TAKES, { priority: 4, cooldown: 0.15, volume: 0.7 }, [
    { id: "bonus.heart", label: "Health", prompt: "Healing power-up collected, warm restorative chime", duration: 0.8 },
    { id: "bonus.magnet", label: "Magnet", prompt: "Magnet power-up collected, magnetic hum rising", duration: 0.8 },
    { id: "bonus.star", label: "Star (invincibility)", prompt: "Invincibility star power-up collected, triumphant sparkle", duration: 0.9 },
    { id: "bonus.lightning", label: "Speed", prompt: "Speed boost power-up collected, quick electric zip", duration: 0.7 },
    { id: "bonus.shield", label: "Shield", prompt: "Protective shield power-up collected, metallic shimmer", duration: 0.8 },
  ]),

  // ---------------- Enemies ----------------
  ...group("enemies", "Enemies", ACTION_TAKES, { priority: 6 }, [
    { id: "enemy.death.small", label: "Small enemy dies", prompt: "Small enemy defeated, short grunt and poof", duration: 0.5, group: "enemy-death", maxVoices: 3, cooldown: 0.05, volume: 0.5 },
    { id: "enemy.death.medium", label: "Medium enemy dies", prompt: "Soldier defeated, groan and armor clatter", duration: 0.6, group: "enemy-death", maxVoices: 3, cooldown: 0.05, volume: 0.6 },
    { id: "enemy.death.large", label: "Large enemy dies", prompt: "Huge brute defeated, heavy fall and thud", duration: 0.9, maxVoices: 2, cooldown: 0.1, priority: 4, volume: 0.75 },
    { id: "enemy.death.elite", label: "Elite (chariot) dies", prompt: "War chariot destroyed, wood breaking and horse whinny", duration: 1.2, maxVoices: 1, cooldown: 0.2, priority: 3, volume: 0.85 },
    { id: "enemy.melee", label: "Enemy melee attack", prompt: "Enemy soldier swinging a weapon, grunt and swish", duration: 0.5, priority: 6, maxVoices: 2, cooldown: 0.12, volume: 0.45 },
    { id: "enemy.arrow", label: "Archer shoots", prompt: "Bow string release and arrow flying", duration: 0.5, maxVoices: 2, cooldown: 0.12, volume: 0.5 },
    { id: "enemy.spear.throw", label: "Spear thrown at Moses", prompt: "Spear hurled through the air, whoosh", duration: 0.5, maxVoices: 2, cooldown: 0.12, volume: 0.5 },
    { id: "enemy.mage.cast", label: "Mage casts light", prompt: "Egyptian sorcerer casting a magic orb, eerie whoosh", duration: 0.7, maxVoices: 2, cooldown: 0.2, volume: 0.55 },
    { id: "enemy.knight.charge", label: "Spear knight charges", prompt: "Armored knight charging, heavy footsteps and battle cry", duration: 0.9, maxVoices: 1, cooldown: 0.4, priority: 4, volume: 0.65 },
    { id: "enemy.agile.dash", label: "Agile soldier dashes", prompt: "Quick dash leap, fast swoosh and dust", duration: 0.5, maxVoices: 1, cooldown: 0.2, volume: 0.45 },
    { id: "enemy.lion.roar", label: "Lion roars and runs", prompt: "Lion roar", duration: 1.0, maxVoices: 1, cooldown: 1.0, priority: 4, volume: 0.65 },
    { id: "enemy.wolf.howl", label: "Wolf wakes up", prompt: "Wolf growl and short howl", duration: 0.9, maxVoices: 1, cooldown: 1.0, volume: 0.55 },
    { id: "enemy.chariot.shoot", label: "Chariot archer shoots", prompt: "Heavy bow shot from a war chariot, rattling wheels", duration: 0.7, maxVoices: 1, cooldown: 0.2, priority: 4, volume: 0.6 },
    { id: "boss.appear", label: "Ramses appears", prompt: "Pharaoh's arrival, deep ominous horns and drums", duration: 2.5, takes: JINGLE_TAKES, priority: 1, maxVoices: 1, cooldown: 2, volume: 0.9 },
    { id: "boss.wake", label: "Ramses rises from the throne", prompt: "Pharaoh rising angrily, deep roar and stone grinding", duration: 1.6, priority: 1, maxVoices: 1, cooldown: 2, volume: 0.9 },
    { id: "boss.smash", label: "Ramses smash", prompt: "Giant warrior smashing the ground, huge boom and rumble", duration: 1.0, priority: 2, maxVoices: 1, cooldown: 0.3, volume: 0.9 },
    { id: "boss.leap", label: "Ramses leaps", prompt: "Heavy giant jumping into the air, whoosh", duration: 0.8, priority: 2, maxVoices: 1, cooldown: 0.5, volume: 0.8 },
    { id: "boss.land", label: "Ramses lands", prompt: "Giant landing after a jump, earth-shaking crash", duration: 1.0, priority: 2, maxVoices: 1, cooldown: 0.5, volume: 0.9 },
    { id: "boss.spear", label: "Ramses throws a flaming spear", prompt: "Flaming spear hurled, fire whoosh", duration: 0.8, priority: 2, maxVoices: 1, cooldown: 0.3, volume: 0.8 },
    { id: "boss.defeated", label: "Ramses defeated", prompt: "Pharaoh defeated and sealed in a stone tomb, heavy stone slab closing with rumble", duration: 2.0, takes: JINGLE_TAKES, priority: 1, maxVoices: 1, cooldown: 2, volume: 0.95 },
    { id: "boss.revive", label: "Ramses revives", prompt: "Stone tomb cracking open and the pharaoh returning, ominous roar", duration: 1.8, priority: 1, maxVoices: 1, cooldown: 2, volume: 0.9 },
  ]),

  // ---------------- Player ----------------
  ...group("player", "Player/Moses", ACTION_TAKES, { priority: 1 }, [
    { id: "player.hurt", label: "Moses takes damage", prompt: "Old man hurt, short pained grunt with a hit", duration: 0.5, maxVoices: 1, cooldown: 0.25, volume: 0.75 },
    { id: "player.shield.absorb", label: "Shield absorbs a hit", prompt: "Magic shield absorbing a hit, shimmering clang", duration: 0.5, maxVoices: 1, cooldown: 0.15, volume: 0.6 },
    { id: "player.helmet.block", label: "Helmet blocks a hit", prompt: "Hit deflected by a bronze helmet, metallic ding", duration: 0.5, maxVoices: 1, cooldown: 0.15, volume: 0.6 },
    { id: "player.death", label: "Moses falls", prompt: "Old man collapsing, final breath and staff falling to the ground", duration: 1.5, maxVoices: 1, cooldown: 2, volume: 0.9 },
    { id: "player.revive", label: "Moses revives (Tree of Life)", prompt: "Miraculous revival, warm rising holy light", duration: 1.5, takes: MAGIC_TAKES, maxVoices: 1, cooldown: 2, volume: 0.9 },
  ]),

  // ---------------- Game events ----------------
  ...group("events", "Events", JINGLE_TAKES, { priority: 1, maxVoices: 1, cooldown: 0.5, pitchVar: 0, volume: 0.85 }, [
    { id: "event.levelup", label: "Level up", prompt: "Level up jingle, rising and joyful, very short", duration: 1.5 },
    { id: "event.plague.unlock", label: "New plague / weapon unlocked", prompt: "New power unlocked, awe-inspiring reveal", duration: 2.0 },
    { id: "event.plague.evolve", label: "Plague / weapon evolution", prompt: "Power upgraded, short rising empowerment", duration: 1.2 },
    { id: "event.blessing", label: "Blessing chosen (passive)", prompt: "Blessing received, short warm sparkle", duration: 1.0 },
    { id: "event.champion.summon", label: "Champion summoned", prompt: "Heroic champion arrives with a blast, battle horn", duration: 2.0 },
    { id: "event.champion.down", label: "Champion knocked down", prompt: "Ally warrior knocked down, groan and fall", duration: 1.0, takes: ACTION_TAKES },
    { id: "event.champion.revive", label: "Champion back on his feet", prompt: "Ally warrior getting back up, short rallying shout", duration: 1.0, takes: ACTION_TAKES },
    { id: "event.gameover", label: "Game over", prompt: "Game over, sad descending melody", duration: 3.0 },
  ]),

  // ---------------- UI ----------------
  ...group("ui", "UI", UI_TAKES, { priority: 2, maxVoices: 1, cooldown: 0.04, pitchVar: 0, volume: 0.5 }, [
    { id: "ui.hover", label: "Button hover", prompt: "Very short subtle UI hover tick", duration: 0.5, priority: 8, cooldown: 0.06, volume: 0.25, restart: true },
    { id: "ui.click", label: "Button click", prompt: "UI button click", duration: 0.5, restart: true },
    { id: "ui.confirm", label: "Confirm", prompt: "UI confirmation, positive short tone", duration: 0.5 },
    { id: "ui.back", label: "Back", prompt: "UI back button, short descending tone", duration: 0.5 },
    { id: "ui.menu.open", label: "Menu opens", prompt: "Menu panel opening, soft swoosh up", duration: 0.5 },
    { id: "ui.menu.close", label: "Menu closes", prompt: "Menu panel closing, soft swoosh down", duration: 0.5 },
    { id: "ui.tab", label: "Tab switch", prompt: "Tab switching, light flick", duration: 0.5, restart: true },
    { id: "ui.pause", label: "Pause", prompt: "Game paused, soft descending tone", duration: 0.6 },
    { id: "ui.resume", label: "Resume", prompt: "Game resumed, soft ascending tone", duration: 0.6 },
    { id: "ui.toggle", label: "Toggle switch", prompt: "Toggle switch flipped, small click", duration: 0.5, restart: true },
    { id: "ui.slider", label: "Slider moved", prompt: "Slider tick, tiny", duration: 0.5, cooldown: 0.07, volume: 0.3, restart: true },
    { id: "ui.error", label: "Error / not allowed", prompt: "UI error, short low buzz denial", duration: 0.5 },
    { id: "ui.buy", label: "Shop purchase (coins)", prompt: "Coins spent in a shop, coin jingle and register", duration: 0.8, takes: PICKUP_TAKES },
    { id: "ui.equip", label: "Equip item", prompt: "Equipping gear, leather and metal clink", duration: 0.5, takes: ACTION_TAKES },
    { id: "ui.card", label: "Level-up card chosen", prompt: "Card selected, satisfying flip and chime", duration: 0.6 },
  ]),
];

/** The events the game plays (the rows of Test Map → Sound testing). */
export const SOUND_ACTIONS: SoundEvent[] = SOUND_EVENTS.filter((e) => !e.retired);

export const SOUND_BY_ID: Record<string, SoundEvent> = Object.fromEntries(SOUND_ACTIONS.map((e) => [e.id, e]));

/** Path under public/ of alternative n (1-5) of an event. */
export function soundPath(ev: SoundEvent, n: number): string {
  return `audio/${ev.folder}/${ev.id.replace(/\./g, "-")}-${n}.mp3`;
}

/** URL of a library sound (path under public/). */
export function libraryUrl(path: string): string {
  return `${import.meta.env?.BASE_URL ?? "/"}${path}`;
}
