import type { PlagueDef, PlagueId, PlagueLevel } from "./types";

// Every plague evolves indefinitely from level 1; each rank bumps damage,
// count, cooldown or area, independently per plague. Multi-attack milestones
// live in ATTACK_MULTI_MILESTONES.
// Scripture strings are shown on unlock so players learn the biblical story.
/** Level after which stat growth slows down (gradual levels 1-5, gentler after). */
export const PLAGUE_GRADUAL_LEVELS = 5;
/** Evolution level -> number of repeated attacks per cast. Extend freely. */
export const ATTACK_MULTI_MILESTONES: Array<{ level: number; casts: number }> = [
  { level: 7, casts: 2 },
  { level: 15, casts: 3 },
  { level: 21, casts: 4 },
  { level: 30, casts: 5 },
  { level: 40, casts: 6 },
];
/** Delay in seconds between repeated attacks of one cast. */
export const MULTI_ATTACK_STAGGER = 0.18;
/** Attacks whose behavior does not fit repeating (persistent/global effects). */
export const NO_MULTI_ATTACK: PlagueId[] = ["darkness", "pillar", "flies"];
export function attackCasts(id: PlagueId, level: number): number {
  if (NO_MULTI_ATTACK.includes(id)) return 1;
  let n = 1;
  for (const m of ATTACK_MULTI_MILESTONES) if (level >= m.level) n = m.casts;
  return n;
}
/** Effective growth ranks: full rate up to level 5, half rate after. */
export function growthRanks(level: number): number {
  const l = Math.max(1, level) - 1;
  const g = PLAGUE_GRADUAL_LEVELS - 1;
  return l <= g ? l : g + (l - g) * 0.5;
}

function scale(base: PlagueLevel, bumps: Partial<Record<keyof PlagueLevel, number>>) {
  return (level: number): PlagueLevel => ({
    ...base,
    level,
    // Cooldown never drops below 60% of base so repeated attacks stay readable.
    cooldown: Math.max(0.15, base.cooldown * 0.6, base.cooldown - (bumps.cooldown ?? 0) * Math.min(level - 1, 8)),
    dmg: base.dmg + (bumps.dmg ?? 0) * growthRanks(level),
    count: base.count + Math.floor((bumps.count ?? 0) * Math.min(level - 1, 8)),
    speed: base.speed + (bumps.speed ?? 0) * Math.min(level - 1, 8),
    ttl: Math.max(base.ttl * 0.5, base.ttl + (bumps.ttl ?? 0) * Math.min(level - 1, 8)),
  });
}

export const PLAGUES: Record<PlagueId, PlagueDef> = {
  staff: {
    id: "staff",
    name: "Staff of Moses",
    description: "Sweeping melee strike with the shepherd's staff.",
    scripture:
      "Exodus 4:2 — 'And the LORD said unto him, What is that in thine hand? And he said, A rod.' Moses' staff becomes the instrument of God's power.",
    unlockLevel: 1,
    base: { level: 1, cooldown: 0.55, dmg: 16, count: 1, speed: 0, ttl: 0.18, extra: { range: 70, arc: 1.05 } },
    scale: scale({ level: 1, cooldown: 0.55, dmg: 16, count: 1, speed: 0, ttl: 0.18 }, {
      cooldown: 0.03,
      dmg: 5,
    }),
  },
  serpent: {
    id: "serpent",
    name: "Staff becomes Serpent",
    description: "Hurl the staff — it becomes a living serpent that slithers forward, piercing foes.",
    scripture:
      "Exodus 7:10-12 — Aaron cast down his rod before Pharaoh, and it became a serpent. It swallowed the sorcerers' serpents whole.",
    unlockLevel: 3,
    // Snake travel speed halved again (182 → 91, +3.5/level).
    // Cooldown doubled (was 1.1 / 0.08 per level) — interval between attack sequences.
    base: { level: 1, cooldown: 2.2, dmg: 14, count: 1, speed: 91, ttl: 1.6 },
    scale: scale({ level: 1, cooldown: 2.2, dmg: 14, count: 1, speed: 91, ttl: 1.6 }, {
      cooldown: 0.16,
      dmg: 4,
      count: 0.25,
      speed: 3.5,
      ttl: 0.05,
    }),

  },
  leprosy: {
    id: "leprosy",
    name: "White Leprosy",
    description: "Moses' hand turns white as snow. The nearest foe is struck with leprosy: it blanches, crawls, and slowly wastes away.",
    scripture:
      "Exodus 4:6 — 'Put now thine hand into thy bosom.' And when he took it out, behold, his hand was leprous as snow. A sign of God's power given to Moses.",
    unlockLevel: 4,
    // Cooldown is rolled fresh between 10 and 15 seconds on every cast (engine);
    // `ttl` is how long the affliction takes to waste the target away; it shortens by 0.3s per evolution rank.
    base: { level: 1, cooldown: 12.5, dmg: 0, count: 1, speed: 0, ttl: 3.5 },
    scale: scale({ level: 1, cooldown: 12.5, dmg: 0, count: 1, speed: 0, ttl: 3.5 }, { ttl: -0.3 }),
  },
  blood: {
    id: "blood",
    name: "Water into Blood",
    description: "A pool of blood appears on the ground, harming every enemy that steps in it.",
    scripture:
      "Exodus 7:20-21 — Moses lifted the rod and smote the waters of the river, and all the waters were turned to blood. The fish died and the Egyptians could not drink.",
    unlockLevel: 10,
    base: { level: 1, cooldown: 5, dmg: 60, count: 1, speed: 0, ttl: 3.5, extra: { radius: 65 } },
    scale: scale({ level: 1, cooldown: 5, dmg: 60, count: 1, speed: 0, ttl: 3.5 }, {
      cooldown: 0.2,
      dmg: 30,
      ttl: 0.25,
    }),
  },
  frogs: {
    id: "frogs",
    name: "Plague of Frogs",
    description: "Hopping frogs bounce across the field, striking any enemy they land on.",
    scripture:
      "Exodus 8:6 — Aaron stretched out his hand over the waters of Egypt, and the frogs came up and covered the land.",
    unlockLevel: 20,
    // Cooldown doubled (was 2.2 / 0.1 per level) — interval between attack sequences.
    base: { level: 1, cooldown: 4.4, dmg: 14, count: 3, speed: 160, ttl: 4 },
    scale: scale({ level: 1, cooldown: 4.4, dmg: 14, count: 3, speed: 160, ttl: 4 }, {
      cooldown: 0.2,
      dmg: 5,
      count: 0.5,
    }),
  },
  gnats: {
    id: "gnats",
    name: "Plague of Gnats (Lice)",
    description: "A dark swarm of gnats drifts across the battlefield, biting anything in its path.",
    scripture:
      "Exodus 8:16-17 — Aaron smote the dust of the earth, and it became lice throughout all the land of Egypt.",
    unlockLevel: 30,
    base: { level: 1, cooldown: 3.5, dmg: 10, count: 1, speed: 70, ttl: 5, extra: { radius: 55 } },
    scale: scale({ level: 1, cooldown: 3.5, dmg: 10, count: 1, speed: 70, ttl: 5 }, {
      cooldown: 0.15,
      dmg: 4,
      count: 0.4,
    }),
  },
  flies: {
    id: "flies",
    name: "Plague of Flies",
    description: "A swarm of flies orbits Moses, striking any enemy they touch. Each rank adds another fly.",
    scripture:
      "Exodus 8:24 — There came a grievous swarm of flies into the house of Pharaoh, and into all the land of Egypt.",
    unlockLevel: 40,
    base: { level: 1, cooldown: 999, dmg: 8, count: 1, speed: 0, ttl: 999 },
    scale: scale({ level: 1, cooldown: 999, dmg: 8, count: 1, speed: 0, ttl: 999 }, {
      dmg: 3,
    }),
  },
  livestock: {
    id: "livestock",
    name: "Plague on Livestock",
    description: "A green poisonous cloud drifts across the field, sickening only animals.",
    scripture:
      "Exodus 9:3-6 — The hand of the LORD is upon thy cattle... a very grievous murrain. All the cattle of Egypt died. This plague strikes only animal-kind.",
    unlockLevel: 50,
    base: { level: 1, cooldown: 6, dmg: 10, count: 1, speed: 45, ttl: 6, extra: { radius: 90 } },
    scale: scale({ level: 1, cooldown: 6, dmg: 10, count: 1, speed: 45, ttl: 6 }, {
      dmg: 3,
      ttl: 0.4,
    }),
  },
  boils: {
    id: "boils",
    name: "Plague of Boils",
    description: "A purple, sickly cloud that erupts painful boils on humans only.",
    scripture:
      "Exodus 9:10 — Moses sprinkled ashes toward heaven, and it became a boil breaking forth with sores upon man. This plague strikes only human-kind.",
    unlockLevel: 60,
    base: { level: 1, cooldown: 6, dmg: 14, count: 1, speed: 45, ttl: 6, extra: { radius: 85 } },
    scale: scale({ level: 1, cooldown: 6, dmg: 14, count: 1, speed: 45, ttl: 6 }, {
      dmg: 4,
      ttl: 0.4,
    }),
  },
  hail: {
    id: "hail",
    name: "Plague of Hail",
    description: "A volley of massive hailstones crashes down — each explodes on impact and freezes nearby foes.",
    scripture:
      "Exodus 9:23-24 — The LORD sent thunder and hail, very grievous. Ice pelts anything caught beneath the sky.",
    unlockLevel: 70,
    base: { level: 1, cooldown: 4, dmg: 28, count: 6, speed: 520, ttl: 0.9, extra: { radius: 70, freeze: 1.5 } },
    scale: scale({ level: 1, cooldown: 4, dmg: 28, count: 6, speed: 520, ttl: 0.9 }, {
      cooldown: 0.15,
      dmg: 6,
      count: 0.5,
    }),
  },
  fire: {
    id: "fire",
    name: "Fire from Heaven",
    description: "Fireballs fall from the sky. Every foe caught in the blast dies instantly — even Pharaoh's chariots.",
    scripture:
      "Exodus 9:24 — There was hail, and fire mingled with the hail, very grievous. The LORD's fire ran along the ground.",
    unlockLevel: 120,
    base: { level: 1, cooldown: 3.5, dmg: 60, count: 1, speed: 560, ttl: 0.9, extra: { radius: 110 } },
    scale: scale({ level: 1, cooldown: 3.5, dmg: 60, count: 1, speed: 560, ttl: 0.9 }, {
      cooldown: 0.15,
      dmg: 15,
    }),
  },
  locusts: {
    id: "locusts",
    name: "Plague of Locusts",
    description: "A massive swarm sweeps down the screen from top to bottom, devouring everything it touches.",
    scripture:
      "Exodus 10:13-15 — The east wind brought the locusts... they covered the face of the whole earth, so that the land was darkened.",
    unlockLevel: 80,
    base: { level: 1, cooldown: 12, dmg: 10, count: 1, speed: 210, ttl: 6, extra: { radius: 130 } },
    scale: scale({ level: 1, cooldown: 12, dmg: 10, count: 1, speed: 210, ttl: 6 }, {
      cooldown: 0.4,
      dmg: 3,
    }),
  },
  darkness: {
    id: "darkness",
    name: "Plague of Darkness",
    description: "Every 30 seconds a supernatural darkness falls — only Moses' lamp remains lit. Enemies slow.",
    scripture:
      "Exodus 10:22 — Moses stretched forth his hand toward heaven, and there was a thick darkness in all the land of Egypt three days.",
    unlockLevel: 90,
    base: { level: 1, cooldown: 30, dmg: 0, count: 1, speed: 0, ttl: 5 },
    scale: scale({ level: 1, cooldown: 30, dmg: 0, count: 1, speed: 0, ttl: 5 }, {
      ttl: 0.3,
    }),
  },
  firstborn: {
    id: "firstborn",
    name: "Death of the Firstborn",
    description: "A dark cloud drifts across the field. Any enemy it touches has a 50% chance to die instantly.",
    scripture:
      "Exodus 12:29 — At midnight the LORD smote all the firstborn in the land of Egypt. A shadow passed over.",
    unlockLevel: 100,
    base: { level: 1, cooldown: 13, dmg: 99999, count: 1, speed: 55, ttl: 7, extra: { radius: 95, chance: 0.5 } },
    scale: scale({ level: 1, cooldown: 13, dmg: 99999, count: 1, speed: 55, ttl: 7 }, {
      cooldown: 0.4,
    }),
  },
  pillar: {
    id: "pillar",
    name: "Pillar of Cloud & Fire",
    description: "A guardian pillar follows Moses, scorching foes that draw near.",
    scripture:
      "Exodus 13:21 — The LORD went before them by day in a pillar of a cloud, and by night in a pillar of fire, to give them light.",
    unlockLevel: 130,
    base: { level: 1, cooldown: 0.5, dmg: 8, count: 1, speed: 0, ttl: 999, extra: { radius: 70 } },
    scale: scale({ level: 1, cooldown: 0.5, dmg: 8, count: 1, speed: 0, ttl: 999 }, {
      dmg: 2,
    }),
  },
  redsea: {
    id: "redsea",
    name: "Parting of the Red Sea",
    description: "Walls of water rush in from both sides and collide at Moses, sweeping the field.",
    scripture:
      "Exodus 14:21-28 — Moses stretched out his hand over the sea; the waters returned and covered the chariots of Pharaoh.",
    unlockLevel: 110,
    base: { level: 1, cooldown: 22, dmg: 60, count: 1, speed: 900, ttl: 1.6, extra: { centerDmg: 220 } },
    scale: scale({ level: 1, cooldown: 22, dmg: 60, count: 1, speed: 900, ttl: 1.6 }, {
      dmg: 20,
      cooldown: 0.8,
    }),
  },
};

// Biblical order. Only after Death of the Firstborn do the miracles appear.
export const PLAGUE_ORDER: PlagueId[] = [
  "staff",
  "serpent",
  "leprosy",
  "blood",
  "frogs",
  "gnats",
  "flies",
  "livestock",
  "boils",
  "hail",
  "locusts",
  "darkness",
  "firstborn",
  // Miracles (post-plagues):
  "redsea",
  "fire",
  "pillar",
];


/**
 * Per-plague evolution tuning. `area` is the radius gain per rank (fraction of
 * the base radius) for plagues whose area does not already grow; `notes[i]`
 * describes what evolving to level i+2 adds. Damage/count/cooldown bumps live
 * in each plague's `scale` above.
 */
export const PLAGUE_EVOLUTION: Record<PlagueId, { area: number; notes: [string, string, string, string] }> = {
  staff: { area: 0, notes: ["Harder strike, faster swings, longer reach.", "Harder strike, faster swings, longer reach.", "Harder strike, faster swings, longer reach.", "Final: a devastating staff blow (+50% damage)."] },
  serpent: { area: 0, notes: ["Stronger bite and quicker throws.", "Stronger bite, quicker throws, faster serpent.", "Stronger bite and quicker throws.", "Final: an extra serpent and a lethal bite."] },
  leprosy: { area: 0, notes: ["Leprosy strikes more often.", "Leprosy strikes more often and wastes faster.", "Leprosy strikes more often.", "Final: strikes two foes at once."] },
  blood: { area: 0, notes: ["Pools burn harder and last longer.", "Pools widen and appear more often.", "Pools burn harder and last longer.", "Final: a vast pool with crushing damage."] },
  frogs: { area: 0, notes: ["More frogs, harder landings.", "Harder landings, faster leaps.", "More frogs, harder landings.", "Final: a flood of frogs that strike hard."] },
  gnats: { area: 0, notes: ["Fiercer bites, wider swarm.", "Fiercer bites, faster swarms.", "An extra swarm drifts out.", "Final: a dense swarm with savage bites."] },
  flies: { area: 0, notes: ["Another fly joins the orbit.", "Another fly joins, stings harder.", "Another fly joins the orbit.", "Final: a full swarm with vicious stings."] },
  livestock: { area: 0.12, notes: ["Wider, more poisonous cloud.", "Wider cloud that lingers longer.", "Wider, more poisonous cloud.", "Final: a huge, deadly murrain."] },
  boils: { area: 0.12, notes: ["Wider cloud, more painful boils.", "Wider cloud that lingers longer.", "Wider cloud, more painful boils.", "Final: a huge cloud of festering boils."] },
  hail: { area: 0.1, notes: ["Wider impacts, faster volleys.", "More hailstones per volley.", "Wider impacts, faster volleys.", "Final: a crushing storm of hail."] },
  locusts: { area: 0.1, notes: ["Wider swarm, sharper bites.", "Swarm returns more often.", "Wider swarm, sharper bites.", "Final: a swarm that darkens the land."] },
  darkness: { area: 0, notes: ["Darkness lasts longer.", "Darkness lasts longer.", "Darkness lasts longer.", "Final: a long, crushing darkness."] },
  firstborn: { area: 0.12, notes: ["A wider shadow, more often.", "A wider shadow, more often.", "A wider shadow, more often.", "Final: a vast shadow of death."] },
  fire: { area: 0.12, notes: ["Bigger blasts, faster falls.", "Bigger blasts, faster falls.", "Bigger blasts, faster falls.", "Final: an enormous fire from heaven."] },
  pillar: { area: 0, notes: ["Hotter flames, wider guard.", "Hotter flames, wider guard.", "Hotter flames, wider guard.", "Final: a blazing pillar."] },
  redsea: { area: 0.1, notes: ["Stronger waves, faster return.", "Stronger waves, wider meeting point.", "Stronger waves, faster return.", "Final: the waters meet with overwhelming force."] },
};

/** Radius multiplier from a plague's evolution level (1 at level 1). */
export function plagueAreaMul(id: PlagueId, level: number): number {
  // Area grows normally to level 5, then slowly (capped at +3 extra ranks).
  const lv = Math.max(1, level);
  return 1 + PLAGUE_EVOLUTION[id].area * (Math.min(lv - 1, 4) + Math.min(3, Math.max(0, lv - 5) * 0.25));
}

/** Card text for evolving to `next` level. */
export function evolutionNote(id: PlagueId, next: number): string {
  const casts = attackCasts(id, next);
  if (casts > attackCasts(id, next - 1)) return `Multi-attack: now strikes ${casts}× per cast.`;
  const n = PLAGUE_EVOLUTION[id].notes[next - 2];
  if (n && !n.startsWith("Final")) return n;
  return "Stronger and more effective.";
}

// Multi-attack plagues multiply their ORIGINAL attack count via attackCasts;
// their per-cast count therefore stays at the base value (no double scaling).
for (const id of Object.keys(PLAGUES) as PlagueId[]) {
  if (NO_MULTI_ATTACK.includes(id)) continue;
  const def = PLAGUES[id];
  const inner = def.scale;
  def.scale = (level: number) => ({ ...inner(level), count: def.base.count });
}
