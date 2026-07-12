import type { PlagueDef, PlagueId, PlagueLevel } from "./types";

// Every plague evolves infinitely: each level bumps damage, count, or utility.
// Only a handful have unique behavior baked into the engine right now — the
// rest are declared here so the level-up screen and future updates can wire
// them in without touching UI code.
function scale(base: PlagueLevel, bumps: Partial<Record<keyof PlagueLevel, number>>) {
  return (level: number): PlagueLevel => ({
    ...base,
    level,
    cooldown: Math.max(0.15, base.cooldown - (bumps.cooldown ?? 0) * (level - 1)),
    dmg: base.dmg + (bumps.dmg ?? 0) * (level - 1),
    count: base.count + Math.floor((bumps.count ?? 0) * (level - 1)),
    speed: base.speed + (bumps.speed ?? 0) * (level - 1),
    ttl: base.ttl + (bumps.ttl ?? 0) * (level - 1),
  });
}

export const PLAGUES: Record<PlagueId, PlagueDef> = {
  serpent: {
    id: "serpent",
    name: "Staff becomes Serpent",
    description: "Living snakes slither forward in a zig-zag, piercing enemies.",
    unlockLevel: 1,
    base: { level: 1, cooldown: 1.1, dmg: 12, count: 1, speed: 260, ttl: 1.6 },
    scale: scale({ level: 1, cooldown: 1.1, dmg: 12, count: 1, speed: 260, ttl: 1.6 }, {
      cooldown: 0.08,
      dmg: 4,
      count: 0.25,
      speed: 10,
      ttl: 0.05,
    }),
  },
  blood: {
    id: "blood",
    name: "Water into Blood",
    description: "Pool of blood spreads around Moses, damaging any enemy inside.",
    unlockLevel: 3,
    base: { level: 1, cooldown: 2.5, dmg: 6, count: 1, speed: 0, ttl: 3.5, extra: { radius: 90 } },
    scale: scale({ level: 1, cooldown: 2.5, dmg: 6, count: 1, speed: 0, ttl: 3.5 }, {
      cooldown: 0.1,
      dmg: 3,
      ttl: 0.25,
    }),
  },
  frogs: {
    id: "frogs",
    name: "Frogs",
    description: "Hopping frogs bounce randomly, striking enemies on impact.",
    unlockLevel: 5,
    base: { level: 1, cooldown: 2.2, dmg: 14, count: 3, speed: 160, ttl: 4 },
    scale: scale({ level: 1, cooldown: 2.2, dmg: 14, count: 3, speed: 160, ttl: 4 }, {
      cooldown: 0.1,
      dmg: 5,
      count: 0.5,
    }),
  },
  gnats: {
    id: "gnats",
    name: "Gnats",
    description: "Swarm orbits Moses, ticking damage on contact.",
    unlockLevel: 7,
    base: { level: 1, cooldown: 0.4, dmg: 3, count: 4, speed: 90, ttl: 999, extra: { radius: 60 } },
    scale: scale({ level: 1, cooldown: 0.4, dmg: 3, count: 4, speed: 90, ttl: 999 }, {
      dmg: 1,
      count: 0.5,
      speed: 4,
    }),
  },
  flies: {
    id: "flies",
    name: "Flies",
    description: "Homing flies seek out the nearest enemy.",
    unlockLevel: 9,
    base: { level: 1, cooldown: 1.6, dmg: 10, count: 2, speed: 180, ttl: 3 },
    scale: scale({ level: 1, cooldown: 1.6, dmg: 10, count: 2, speed: 180, ttl: 3 }, {
      cooldown: 0.1,
      dmg: 3,
      count: 0.5,
    }),
  },
  livestock: {
    id: "livestock",
    name: "Livestock Plague",
    description: "Enemies rot: periodically weakens all foes in range.",
    unlockLevel: 11,
    base: { level: 1, cooldown: 4, dmg: 5, count: 1, speed: 0, ttl: 1, extra: { radius: 160 } },
    scale: scale({ level: 1, cooldown: 4, dmg: 5, count: 1, speed: 0, ttl: 1 }, {
      dmg: 2,
    }),
  },
  boils: {
    id: "boils",
    name: "Boils",
    description: "Fiery boils erupt from the ground around Moses.",
    unlockLevel: 13,
    base: { level: 1, cooldown: 3, dmg: 20, count: 3, speed: 0, ttl: 0.6, extra: { radius: 40 } },
    scale: scale({ level: 1, cooldown: 3, dmg: 20, count: 3, speed: 0, ttl: 0.6 }, {
      dmg: 6,
      count: 0.5,
    }),
  },
  hail: {
    id: "hail",
    name: "Hail",
    description: "Chunks of hail rain from the sky in a wide arc.",
    unlockLevel: 15,
    base: { level: 1, cooldown: 3.5, dmg: 22, count: 5, speed: 220, ttl: 1.4 },
    scale: scale({ level: 1, cooldown: 3.5, dmg: 22, count: 5, speed: 220, ttl: 1.4 }, {
      dmg: 5,
      count: 0.7,
    }),
  },
  locusts: {
    id: "locusts",
    name: "Locusts",
    description: "Cloud of locusts sweeps across the field.",
    unlockLevel: 17,
    base: { level: 1, cooldown: 5, dmg: 4, count: 12, speed: 130, ttl: 2.5 },
    scale: scale({ level: 1, cooldown: 5, dmg: 4, count: 12, speed: 130, ttl: 2.5 }, {
      dmg: 2,
      count: 1.5,
    }),
  },
  darkness: {
    id: "darkness",
    name: "Darkness",
    description: "A veil dims the field; enemies slow and take extra damage.",
    unlockLevel: 19,
    base: { level: 1, cooldown: 8, dmg: 0, count: 1, speed: 0, ttl: 4 },
    scale: scale({ level: 1, cooldown: 8, dmg: 0, count: 1, speed: 0, ttl: 4 }, {
      ttl: 0.4,
    }),
  },
  firstborn: {
    id: "firstborn",
    name: "Death of the Firstborn",
    description: "Once per minute, instantly slays the strongest enemy nearby.",
    unlockLevel: 22,
    base: { level: 1, cooldown: 60, dmg: 99999, count: 1, speed: 0, ttl: 0.1 },
    scale: scale({ level: 1, cooldown: 60, dmg: 99999, count: 1, speed: 0, ttl: 0.1 }, {
      cooldown: 4,
    }),
  },
  pillar: {
    id: "pillar",
    name: "Pillar of Cloud & Fire",
    description: "Guardian pillar follows Moses, scorching adjacent foes.",
    unlockLevel: 25,
    base: { level: 1, cooldown: 0.5, dmg: 8, count: 1, speed: 0, ttl: 999, extra: { radius: 70 } },
    scale: scale({ level: 1, cooldown: 0.5, dmg: 8, count: 1, speed: 0, ttl: 999 }, {
      dmg: 2,
    }),
  },
  redsea: {
    id: "redsea",
    name: "Parting of the Red Sea",
    description: "A tidal wave crashes across the map, wiping out all in its path.",
    unlockLevel: 30,
    base: { level: 1, cooldown: 45, dmg: 200, count: 1, speed: 320, ttl: 2.5 },
    scale: scale({ level: 1, cooldown: 45, dmg: 200, count: 1, speed: 320, ttl: 2.5 }, {
      dmg: 60,
      cooldown: 2,
    }),
  },
};

export const PLAGUE_ORDER: PlagueId[] = [
  "serpent",
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
  "pillar",
  "redsea",
];
