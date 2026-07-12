// Shared type definitions for the Exodus Survivors game engine.
export type Vec2 = { x: number; y: number };

export type Entity = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number; // for collision
  hp: number;
  maxHp: number;
  team: "player" | "ally" | "enemy" | "projectile" | "pickup" | "decor" | "hazard" | "orbit";
  facing: 1 | -1;
  animT: number; // seconds
  born: number; // spawn time
  ttl?: number; // for projectiles
  dmg?: number;
  ownerId?: number;
  kind: string; // e.g. "moses" | "serpent" | "soldier" | "jackal" | "gem" | ...
  data?: Record<string, unknown>;
};

export type PlagueId =
  | "staff"
  | "serpent"
  | "blood"
  | "frogs"
  | "gnats"
  | "flies"
  | "livestock"
  | "boils"
  | "hail"
  | "fire"
  | "locusts"
  | "darkness"
  | "firstborn"
  | "pillar"
  | "redsea";

export type NpcId =
  | "bithiah"
  | "aaron"
  | "miriam"
  | "jethro"
  | "zipporah"
  | "joshua"
  | "hur"
  | "elder";

export type UpgradeChoice = {
  id: string;
  plague: PlagueId;
  title: string;
  description: string;
  scripture?: string;
  isUnlock?: boolean;
  apply: (state: GameState) => void;
};

export type PlagueLevel = {
  level: number;
  cooldown: number; // seconds between casts
  dmg: number;
  count: number; // projectiles per cast
  speed: number;
  ttl: number;
  extra?: Record<string, number>;
};

export type PlagueDef = {
  id: PlagueId;
  name: string;
  description: string;
  scripture?: string; // biblical reference + brief explanation
  unlockLevel: number; // player level at which offered
  base: PlagueLevel;
  scale: (level: number) => PlagueLevel; // infinite evolution
};

export type NpcDef = {
  id: NpcId;
  name: string;
  description: string;
  scripture?: string;
};

export type GameState = {
  now: number; // seconds since run start
  running: boolean;
  paused: boolean;
  levelUpPending: UpgradeChoice[] | null;
  gameOver: boolean;

  camera: Vec2;
  entities: Map<number, Entity>;
  nextId: number;

  player: Entity;
  xp: number;
  level: number;
  xpToNext: number;

  kills: number;
  survivalSeconds: number;

  // active plagues -> current level
  plagues: Map<PlagueId, number>;
  plagueCooldown: Map<PlagueId, number>;

  // unlocked npc ids -> entity id
  npcs: Map<NpcId, number>;
  nextNpcIndex: number; // how many companions unlocked

  // NEW badges — cleared once the player views/interacts with the item.
  newPlagues: Set<PlagueId>;
  newNpcs: Set<NpcId>;

  // input
  input: { x: number; y: number };

  // world bounds — very large "infinite feel"
  worldW: number;
  worldH: number;

  // last known viewport size (set each frame by the renderer)
  viewport?: { w: number; h: number };

  // ids of the flies that permanently orbit the player
  orbitFlyIds?: number[];
};
