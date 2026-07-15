import type { PlagueDef, PlagueId, PlagueLevel } from "./types";

// Every plague evolves infinitely: each level bumps damage, count, or utility.
// Scripture strings are shown on unlock so players learn the biblical story.
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
    base: { level: 1, cooldown: 1.1, dmg: 14, count: 1, speed: 260, ttl: 1.6 },
    scale: scale({ level: 1, cooldown: 1.1, dmg: 14, count: 1, speed: 260, ttl: 1.6 }, {
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
    description: "A pool of blood appears on the ground, harming every enemy that steps in it.",
    scripture:
      "Exodus 7:20-21 — Moses lifted the rod and smote the waters of the river, and all the waters were turned to blood. The fish died and the Egyptians could not drink.",
    unlockLevel: 4,
    base: { level: 1, cooldown: 5, dmg: 6, count: 1, speed: 0, ttl: 3.5, extra: { radius: 65 } },
    scale: scale({ level: 1, cooldown: 5, dmg: 6, count: 1, speed: 0, ttl: 3.5 }, {
      cooldown: 0.2,
      dmg: 3,
      ttl: 0.25,
    }),
  },
  frogs: {
    id: "frogs",
    name: "Plague of Frogs",
    description: "Hopping frogs bounce across the field, striking any enemy they land on.",
    scripture:
      "Exodus 8:6 — Aaron stretched out his hand over the waters of Egypt, and the frogs came up and covered the land.",
    unlockLevel: 6,
    base: { level: 1, cooldown: 2.2, dmg: 14, count: 3, speed: 160, ttl: 4 },
    scale: scale({ level: 1, cooldown: 2.2, dmg: 14, count: 3, speed: 160, ttl: 4 }, {
      cooldown: 0.1,
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
    unlockLevel: 8,
    base: { level: 1, cooldown: 3.5, dmg: 5, count: 1, speed: 70, ttl: 5, extra: { radius: 55 } },
    scale: scale({ level: 1, cooldown: 3.5, dmg: 5, count: 1, speed: 70, ttl: 5 }, {
      cooldown: 0.15,
      dmg: 2,
      count: 0.4,
    }),
  },
  flies: {
    id: "flies",
    name: "Plague of Flies",
    description: "A swarm of flies orbits Moses, striking any enemy they touch. Each rank adds another fly.",
    scripture:
      "Exodus 8:24 — There came a grievous swarm of flies into the house of Pharaoh, and into all the land of Egypt.",
    unlockLevel: 10,
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
    unlockLevel: 12,
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
    unlockLevel: 14,
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
    unlockLevel: 16,
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
    unlockLevel: 26,
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
    unlockLevel: 18,
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
    unlockLevel: 20,
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
    unlockLevel: 22,
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
    unlockLevel: 28,
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
    unlockLevel: 24,
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

