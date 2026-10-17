// Complete shop catalogue for Exodus Survivors.
// All names, prices and stat values come from the shop design specification.
// Pure data — no gameplay logic lives here.

export type ShopCategory = "weapon" | "staff" | "food" | "shield" | "footwear";

export type Evolution = {
  /** 1..3 */
  level: number;
  name: string;
  price: number;
  /** short stat line, e.g. "Damage 0.65" or "+10% magical damage" */
  stat: string;
  /** special ability description, empty when none */
  ability: string;
  /** numeric stats used by gameplay integration */
  dmg?: number;
  magicPct?: number;
  hpPct?: number;
  regen?: number;
  resurrect?: boolean;
  capPct?: number;
  speedPct?: number;
};

export type EquipItem = {
  id: string;
  category: ShopCategory;
  /** family name, e.g. "Dagger" */
  name: string;
  description: string;
  /** true when the item has three separately purchasable evolutions */
  hasEvolutions: boolean;
  evolutions: Evolution[];
};

function ev(
  level: number, name: string, price: number, stat: string, ability = "",
  nums: Partial<Pick<Evolution, "dmg" | "magicPct" | "hpPct" | "regen" | "resurrect" | "capPct" | "speedPct">> = {},
): Evolution {
  return { level, name, price, stat, ability, ...nums };
}

function item(
  id: string,
  category: ShopCategory,
  name: string,
  description: string,
  evolutions: Evolution[],
): EquipItem {
  return { id, category, name, description, hasEvolutions: evolutions.length > 1, evolutions };
}

// ---------------------------------------------------------------- weapons
export const WEAPONS: EquipItem[] = [
  item("branch", "weapon", "Tree of Life Branch", "A living branch, Moses' first weapon.", [
    ev(1, "Branch of the Tree of Life", 0, "Damage 0.5", "Short frontal cone attack with slight knockback.", { dmg: 0.5 }),
    ev(2, "Branch of the Tree of Knowledge", 150_000, "Damage 0.65", "Wider frontal attack with greater reach and knockback.", { dmg: 0.65 }),
    ev(3, "Branch of the Eternal Tree", 1_000_000, "Damage 0.8", "Wide frontal attack that creates a small shockwave.", { dmg: 0.8 }),
  ]),
  item("dagger", "weapon", "Dagger", "A quick blade that poisons what it cuts.", [
    ev(1, "Fang of Eden", 100, "Damage 0.65", "Fast frontal slash that poisons enemies for 5 seconds.", { dmg: 0.65 }),
    ev(2, "Fang of the Serpent", 220_000, "Damage 0.8", "Wider slash; poison lasts 8 seconds and spreads when a poisoned enemy dies.", { dmg: 0.8 }),
    ev(3, "Fang of the Ancient Serpent", 1_500_000, "Damage 0.95", "Wide slash affecting several nearby enemies; poisoned enemies create a toxic cloud when they die.", { dmg: 0.95 }),
  ]),
  item("spear", "weapon", "Spear", "A straight thrust that becomes a thrown projectile.", [
    ev(1, "Spear of Nod", 1_000, "Damage 0.75", "Straight projectile that pushes enemies.", { dmg: 0.75 }),
    ev(2, "Spear of the Patriarchs", 320_000, "Damage 0.9", "Pierces multiple enemies with greater range and knockback.", { dmg: 0.9 }),
    ev(3, "Spear of the Promise", 1_800_000, "Damage 1.05", "Long piercing projectile with a luminous damaging trail.", { dmg: 1.05 }),
  ]),
  item("sword", "weapon", "Sword", "A blade that grows sharper with every strike.", [
    ev(1, "Serpent Sword", 3_000, "Damage 0.9", "Frontal slash; every 10 attacks deal a critical hit.", { dmg: 0.9 }),
    ev(2, "Sword of the Cherubim", 450_000, "Damage 1.05", "Frontal slash followed by an air wave; critical hit every 8 attacks.", { dmg: 1.05 }),
    ev(3, "Eden's Flaming Sword", 2_500_000, "Damage 1.2", "Wider slash followed by a second wave that can briefly burn enemies.", { dmg: 1.2 }),
  ]),
  item("harpoon", "weapon", "Harpoon", "An ancient wooden shaft with a bronze fishing point.", [
    ev(1, "Harpoon of the Abyss", 9_000, "Damage 0.9", "Straight projectile with moderate knockback.", { dmg: 0.9 }),
    ev(2, "Harpoon of Primordial Waters", 650_000, "Damage 1.05", "Pierces enemies and creates a damaging water whirlpool for 2 seconds.", { dmg: 1.05 }),
    ev(3, "Harpoon of the Depths", 3_500_000, "Damage 1.2", "Longer piercing projectile that creates a larger whirlpool which damages and slows enemies.", { dmg: 1.2 }),
  ]),
  item("axe", "weapon", "Axe", "Cuts a long ground-level line in the direction Moses moves.", [
    ev(1, "Axe of Cain", 15_000, "Damage 1.1", "Long, narrow cutting line that damages every enemy it intersects.", { dmg: 1.1 }),
    ev(2, "Axe of Tubal-Cain", 900_000, "Damage 1.25", "Longer and wider line that slows enemies for 2 seconds.", { dmg: 1.25 }),
    ev(3, "Axe of the Flood", 4_500_000, "Damage 1.4", "Very long, wide cut that leaves damaging cracks.", { dmg: 1.4 }),
  ]),
  item("boomerang", "weapon", "Boomerang", "A returning projectile; each evolution adds another.", [
    ev(1, "Rainbow Boomerang", 25_000, "Damage 0.9 per hit", "One returning boomerang that can hit multiple times.", { dmg: 0.9 }),
    ev(2, "Boomerang of the Promise", 1_300_000, "Damage 0.8 per hit", "Two boomerangs with different trajectories.", { dmg: 0.8 }),
    ev(3, "Boomerang of the Eternal Covenant", 5_500_000, "Damage 0.75 per hit", "Three boomerangs with rebounds and damaging flashes.", { dmg: 0.75 }),
  ]),
  item("mace", "weapon", "Mace", "Its damage area is centered on the impact point, not on Moses.", [
    ev(1, "Mace of the Giants", 50_000, "Damage 1.3", "Small cracked-ground impact circle.", { dmg: 1.3 }),
    ev(2, "Mace of the Flood", 1_900_000, "Damage 1.45", "Larger impact radius, more visible cracks and greater damage.", { dmg: 1.45 }),
    ev(3, "Mace of Judgment", 7_000_000, "Damage 1.6", "Wide cracked-ground impact that causes a second damage event.", { dmg: 1.6 }),
  ]),
  item("ring", "weapon", "Ring", "Thrown, rebounds between enemies and returns to Moses.", [
    ev(1, "Ring of the Cherubim", 100_000, "Damage 1.0", "The ring is thrown, rebounds between enemies and returns to Moses.", { dmg: 1.0 }),
    ev(2, "Ring of the Firmament", 2_800_000, "Damage 1.1", "Wider path with small rings along its trail that cause additional damage.", { dmg: 1.1 }),
    ev(3, "Celestial Ring", 9_000_000, "Damage 1.2", "Returns at lightning speed and deals double damage on its return, with electrical effects.", { dmg: 1.2 }),
  ]),
];

// ---------------------------------------------------------------- staffs
export const STAFFS: EquipItem[] = [
  item("moses", "staff", "Staff of Moses", "The staff that turned into a serpent before Pharaoh.", [
    ev(1, "Staff of Moses I", 0, "+0% magical damage", "", { magicPct: 0 }),
    ev(2, "Staff of Moses II", 100_000, "+10% magical damage", "", { magicPct: 10 }),
    ev(3, "Staff of Moses III", 1_000_000, "+20% magical damage", "", { magicPct: 20 }),
  ]),
  item("iron", "staff", "Iron Staff", "A heavy staff that weighs enemies down.", [
    ev(1, "Iron Staff I", 500, "+10% magical damage", "", { magicPct: 10 }),
    ev(2, "Iron Staff II", 150_000, "+25% magical damage", "Plagues slightly slow enemies.", { magicPct: 25 }),
    ev(3, "Iron Staff III", 1_500_000, "+40% magical damage", "Plagues slow enemies for longer.", { magicPct: 40 }),
  ]),
  item("crystal", "staff", "Crystal Staff", "Its light blinds the enemies of Israel.", [
    ev(1, "Crystal Staff I", 5_000, "+20% magical damage", "", { magicPct: 20 }),
    ev(2, "Crystal Staff II", 250_000, "+35% magical damage", "Blinds one enemy for 3 seconds every 15 seconds.", { magicPct: 35 }),
    ev(3, "Crystal Staff III", 2_500_000, "+50% magical damage", "Blinds three enemies for 4 seconds every 15 seconds.", { magicPct: 50 }),
  ]),
  item("diamond", "staff", "Diamond Staff", "A harder light, a deeper blindness.", [
    ev(1, "Diamond Staff I", 50_000, "+35% magical damage", "", { magicPct: 35 }),
    ev(2, "Diamond Staff II", 500_000, "+50% magical damage", "Blinds three enemies for 3 seconds every 15 seconds.", { magicPct: 50 }),
    ev(3, "Diamond Staff III", 5_000_000, "+70% magical damage", "Blinds five enemies for 4 seconds every 15 seconds.", { magicPct: 70 }),
  ]),
  item("bronze", "staff", "Burning Bronze Staff", "Bronze that remembers the furnace.", [
    ev(1, "Burning Bronze Staff I", 250_000, "+50% magical damage", "", { magicPct: 50 }),
    ev(2, "Burning Bronze Staff II", 1_000_000, "+70% magical damage", "Creates a ring of fire every 25 seconds.", { magicPct: 70 }),
    ev(3, "Burning Bronze Staff III", 10_000_000, "+90% magical damage", "Creates a larger ring of fire every 20 seconds that burns enemies.", { magicPct: 90 }),
  ]),
  item("fire", "staff", "Fire Staff", "Fire that walks with Moses.", [
    ev(1, "Fire Staff I", 1_000_000, "+70% magical damage", "", { magicPct: 70 }),
    ev(2, "Fire Staff II", 2_500_000, "+90% magical damage", "Burns last longer.", { magicPct: 90 }),
    ev(3, "Fire Staff III", 20_000_000, "+110% magical damage", "Fire spreads to nearby enemies.", { magicPct: 110 }),
  ]),
  item("bush", "staff", "Burning Bush Staff", "The bush that burned and was not consumed.", [
    ev(1, "Burning Bush Staff I", 5_000_000, "+90% magical damage", "", { magicPct: 90 }),
    ev(2, "Burning Bush Staff II", 10_000_000, "+115% magical damage", "Launches flames at three enemies every 20 seconds.", { magicPct: 115 }),
    ev(3, "Burning Bush Staff III", 35_000_000, "+140% magical damage", "Launches flames at five enemies every 18 seconds.", { magicPct: 140 }),
  ]),
  item("waters", "staff", "Staff of Primordial Waters", "The waters that were before the firmament.", [
    ev(1, "Staff of Primordial Waters I", 20_000_000, "+120% magical damage", "", { magicPct: 120 }),
    ev(2, "Staff of Primordial Waters II", 35_000_000, "+145% magical damage", "Creates a slowing wave every 25 seconds.", { magicPct: 145 }),
    ev(3, "Staff of Primordial Waters III", 60_000_000, "+170% magical damage", "Creates a larger, more damaging wave every 20 seconds.", { magicPct: 170 }),
  ]),
  item("light", "staff", "Staff of Divine Light", "Lightning answerable to prayer.", [
    ev(1, "Staff of Divine Light I", 75_000_000, "+160% magical damage", "", { magicPct: 160 }),
    ev(2, "Staff of Divine Light II", 100_000_000, "+180% magical damage", "A lightning strike hits three enemies every 25 seconds.", { magicPct: 180 }),
    ev(3, "Staff of Divine Light III", 150_000_000, "+200% magical damage", "A lightning strike hits five enemies every 20 seconds.", { magicPct: 200 }),
  ]),
  item("power", "staff", "Staff of God's Power", "The might of the LORD, measured out in mercy.", [
    ev(1, "Staff of God's Power I", 200_000_000, "+200% magical damage", "", { magicPct: 200 }),
    ev(2, "Staff of God's Power II", 300_000_000, "+250% magical damage", "A powerful lightning strike hits three enemies every 25 seconds.", { magicPct: 250 }),
    ev(3, "Staff of God's Power III", 500_000_000, "+300% magical damage", "A massive lightning strike hits five enemies every 20 seconds. It wounds Ramses gravely but never kills him with one hit.", { magicPct: 300 }),
  ]),
];

// ---------------------------------------------------------------- food
export const FOODS: EquipItem[] = [
  item("sandwich", "food", "Miriam's Sandwich", "Made with sisterly love.", [ev(1, "Miriam's Sandwich", 0, "+1% maximum health", { hpPct: 1 })]),
  item("lentils", "food", "Esau's Lentil Stew", "Worth more than a birthright.", [ev(1, "Esau's Lentil Stew", 5_000, "+5% maximum health", { hpPct: 5 })]),
  item("bread", "food", "Abraham's Bread", "Bread of hospitality under the oaks of Mamre.", [ev(1, "Abraham's Bread", 50_000, "+10% maximum health", { hpPct: 10 })]),
  item("jacob", "food", "Jacob's Meal", "A meal for a long journey.", [ev(1, "Jacob's Meal", 250_000, "+20% maximum health", { hpPct: 20 })]),
  item("blessing", "food", "Bread of Blessing", "Bread that restores as it feeds.", [ev(1, "Bread of Blessing", 1_000_000, "+35% maximum health", "Regenerates 0.5 HP per second.", { hpPct: 35, regen: 0.5 })]),
  item("banquet", "food", "Banquet of the Promise", "A table set in the wilderness.", [ev(1, "Banquet of the Promise", 5_000_000, "+50% maximum health", "Regenerates 0.5 HP per second.", { hpPct: 50, regen: 0.5 })]),
  item("manna", "food", "Manna of the Desert", "Bread from heaven, gathered each morning.", [ev(1, "Manna of the Desert", 15_000_000, "+75% maximum health", "Regenerates 1 HP per second.", { hpPct: 75, regen: 1 })]),
  item("patriarchs", "food", "Meal of the Patriarchs", "The table of Abraham, Isaac and Jacob.", [ev(1, "Meal of the Patriarchs", 35_000_000, "+100% maximum health", "Regenerates 1 HP per second.", { hpPct: 100, regen: 1 })]),
  item("elixir", "food", "Elixir of Life", "A draught of long years.", [ev(1, "Elixir of Life", 65_000_000, "+150% maximum health", "Regenerates 2 HP per second.", { hpPct: 150, regen: 2 })]),
  item("fruit", "food", "Fruit of the Tree of Life", "The fruit guarded by the cherubim.", [ev(1, "Fruit of the Tree of Life", 120_000_000, "+200% maximum health", "Regenerates 2 HP per second and allows one resurrection per run with half health and no shield.", { hpPct: 200, regen: 2, resurrect: true })]),
];

// ---------------------------------------------------------------- shields
export const SHIELDS: EquipItem[] = [
  item("abel", "shield", "Shield of Abel", "The accepted offering, a blue guard.", [
    ev(1, "Shield of Abel I", 0, "+1% shield capacity", { capPct: 1 }),
    ev(2, "Shield of Abel II", 500_000, "+50% shield capacity", { capPct: 50 }),
    ev(3, "Shield of Abel III", 5_000_000, "+100% shield capacity", { capPct: 100 }),
  ]),
  item("noah", "shield", "Protection of Noah", "Covering like the ark's pitch.", [
    ev(1, "Protection of Noah I", 100_000, "+45% shield capacity", { capPct: 45 }),
    ev(2, "Protection of Noah II", 1_000_000, "+75% shield capacity", "Reduces projectile damage.", { capPct: 75 }),
    ev(3, "Protection of Noah III", 10_000_000, "+120% shield capacity", "Reduces projectile damage further.", { capPct: 120 }),
  ]),
  item("abraham", "shield", "Shield of Abraham", "Fear not: I am thy shield.", [
    ev(1, "Shield of Abraham I", 250_000, "+55% shield capacity", { capPct: 55 }),
    ev(2, "Shield of Abraham II", 2_000_000, "+90% shield capacity", "A sphere absorbs one hit and recharges in 15 seconds.", { capPct: 90 }),
    ev(3, "Shield of Abraham III", 20_000_000, "+140% shield capacity", "The sphere recharges in 10 seconds.", { capPct: 140 }),
  ]),
  item("jacobm", "shield", "Mantle of Jacob", "A covering on the stony road.", [
    ev(1, "Mantle of Jacob I", 400_000, "+60% shield capacity", { capPct: 60 }),
    ev(2, "Mantle of Jacob II", 3_000_000, "+100% shield capacity", "A cloud blocks projectiles from behind.", { capPct: 100 }),
    ev(3, "Mantle of Jacob III", 30_000_000, "+150% shield capacity", "A larger cloud blocks more projectiles.", { capPct: 150 }),
  ]),
  item("joseph", "shield", "Shield of Joseph", "The coat of many colours, turned to armor.", [
    ev(1, "Shield of Joseph I", 600_000, "+65% shield capacity", { capPct: 65 }),
    ev(2, "Shield of Joseph II", 5_000_000, "+110% shield capacity", "Taking damage increases movement speed for 2 seconds.", { capPct: 110 }),
    ev(3, "Shield of Joseph III", 40_000_000, "+160% shield capacity", "A stronger speed increase for 3 seconds.", { capPct: 160 }),
  ]),
  item("bushp", "shield", "Burning Bush Protection", "Fire that guards instead of consuming.", [
    ev(1, "Burning Bush Protection I", 1_000_000, "+70% shield capacity", { capPct: 70 }),
    ev(2, "Burning Bush Protection II", 8_000_000, "+120% shield capacity", "A fire aura damages nearby enemies.", { capPct: 120 }),
    ev(3, "Burning Bush Protection III", 60_000_000, "+170% shield capacity", "A larger aura burns enemies for longer.", { capPct: 170 }),
  ]),
  item("promise", "shield", "Shield of the Promise", "The covenant stands between you and harm.", [
    ev(1, "Shield of the Promise I", 2_000_000, "+80% shield capacity", { capPct: 80 }),
    ev(2, "Shield of the Promise II", 12_000_000, "+130% shield capacity", "Blocks one hit every 20 seconds.", { capPct: 130 }),
    ev(3, "Shield of the Promise III", 80_000_000, "+180% shield capacity", "Blocks one hit every 12 seconds.", { capPct: 180 }),
  ]),
  item("cloud", "shield", "Mantle of the Cloud", "The cloud that stood between the camps.", [
    ev(1, "Mantle of the Cloud I", 5_000_000, "+90% shield capacity", { capPct: 90 }),
    ev(2, "Mantle of the Cloud II", 20_000_000, "+140% shield capacity", "A cloud blocks projectiles from every direction.", { capPct: 140 }),
    ev(3, "Mantle of the Cloud III", 100_000_000, "+190% shield capacity", "Improves the cloud's effectiveness and recovery.", { capPct: 190 }),
  ]),
  item("covenant", "shield", "Light of the Covenant", "Light that drives back the darkness.", [
    ev(1, "Light of the Covenant I", 10_000_000, "+100% shield capacity", { capPct: 100 }),
    ev(2, "Light of the Covenant II", 30_000_000, "+160% shield capacity", "Repels enemies when health falls below 30%.", { capPct: 160 }),
    ev(3, "Light of the Covenant III", 150_000_000, "+220% shield capacity", "A larger wave also slows enemies.", { capPct: 220 }),
  ]),
  item("israel", "shield", "Shield of the God of Israel", "The LORD shall preserve thy going out and thy coming in.", [
    ev(1, "Shield of the God of Israel I", 100_000, "+45% shield capacity", { capPct: 45 }),
    ev(2, "Shield of the God of Israel II", 50_000_000, "+200% shield capacity", "Once per run, survive a lethal hit with 20% health remaining.", { capPct: 200 }),
    ev(3, "Shield of the God of Israel III", 250_000_000, "+300% shield capacity", "Once per run, survive a lethal hit with 35% health remaining.", { capPct: 300 }),
  ]),
];

// ---------------------------------------------------------------- footwear
export const FOOTWEAR: EquipItem[] = [
  item("barefoot", "footwear", "Barefoot, Sacred Ground", "Put off thy shoes, for the ground is holy.", [ev(1, "Barefoot, Sacred Ground", 0, "+0% speed", { speedPct: 0 })]),
  item("patriarchs", "footwear", "Sandals of the Patriarchs", "Worn on the road to Moriah.", [ev(1, "Sandals of the Patriarchs", 350, "+5% speed", "Brown glow.", { hpPct: 100, regen: 1 })]),
  item("pilgrim", "footwear", "Pilgrim's Sandals", "For the long walk of faith.", [ev(1, "Pilgrim's Sandals", 7_000, "+10% speed", "1-second speed boost every 30 seconds; beige-gold glow.", { speedPct: 10 })]),
  item("joshua", "footwear", "Boots of Joshua", "Every place the sole of your foot treads.", [ev(1, "Boots of Joshua", 35_000, "+20% speed", "1-second speed boost every 25 seconds; olive-green glow.", { speedPct: 20 })]),
  item("wind", "footwear", "Sandals of the Wind", "Swift as the east wind.", [ev(1, "Sandals of the Wind", 110_000, "+25% speed", "Leaves a lightly damaging light-blue trail.", { speedPct: 25 })]),
  item("messenger", "footwear", "Messenger's Footwear", "How beautiful upon the mountains.", [ev(1, "Messenger's Footwear", 350_000, "+30% speed", "Attracts coins from farther away; blue-white glow.", { speedPct: 30 })]),
  item("jordan", "footwear", "Sandals of the Jordan", "The waters stood still for these steps.", [ev(1, "Sandals of the Jordan", 1_000_000, "+35% speed", "Leaves aqua footprints that briefly slow enemies.", { speedPct: 35 })]),
  item("bushb", "footwear", "Burning Bush Boots", "Fire underfoot, harmlessly.", [ev(1, "Burning Bush Boots", 3_000_000, "+40% speed", "Repels enemies every 20 seconds without damaging them; orange flash.", { speedPct: 40 })]),
  item("invisible", "footwear", "Sandals of the Invisible Path", "A way where there was no way.", [ev(1, "Sandals of the Invisible Path", 8_000_000, "+45% speed", "Teleports every 15 seconds to a visible area with few enemies; violet flash.", { speedPct: 45 })]),
  item("exodus", "footwear", "Sandals of the Exodus", "Your shoes did not wear out in forty years.", [ev(1, "Sandals of the Exodus", 20_000_000, "+50% speed", "If Moses takes no damage for 5 seconds, +20% extra speed; damage removes it and restarts the wait. Intense golden glow while active.", { speedPct: 50 })]),
];

// ---------------------------------------------------------------- champions
export type ChampionEvo = {
  level: number;
  price: number;
  /** percentage of Miriam's attack (0 = no attack damage) */
  attackPct: number;
  /** percentage of Miriam's health */
  healthPct: number;
  ability: string;
};

export type ChampionDef = {
  id: string;
  name: string;
  relationship: string;
  evolutions: [ChampionEvo, ChampionEvo, ChampionEvo];
};

function cev(level: number, price: number, attackPct: number, healthPct: number, ability: string): ChampionEvo {
  return { level, price, attackPct, healthPct, ability };
}

export const CHAMPIONS: ChampionDef[] = [
  {
    id: "miriam", name: "Miriam", relationship: "Moses' sister, the prophetess with the timbrel.",
    evolutions: [
      cev(1, 400, 100, 100, "Sweeps in an arc and hits nearby enemies."),
      cev(2, 600_000, 150, 110, "Stronger sweep, farther dust and more targets."),
      cev(3, 1_500_000, 250, 130, "Creates damaging whirlwinds over a wider area."),
    ],
  },
  {
    id: "zipporah", name: "Zipporah", relationship: "Moses' wife, daughter of Jethro.",
    evolutions: [
      cev(1, 1_200, 90, 85, "Throws fast stones that do not pierce."),
      cev(2, 800_000, 140, 100, "Throws two stones more frequently; they pierce enemies."),
      cev(3, 2_000_000, 230, 120, "Periodically throws stones in several directions."),
    ],
  },
  {
    id: "puah", name: "Puah", relationship: "The midwife who feared God and spared the children.",
    evolutions: [
      cev(1, 2_500, 0, 140, "Throws healing vials at the nearest ally, including Moses and champions, and flees enemies."),
      cev(2, 1_000_000, 0, 180, "Throws two vials and heals twice as much."),
      cev(3, 2_600_000, 0, 250, "Throws a vial near Moses, creating a marked healing area for 10 seconds."),
    ],
  },
  {
    id: "shiphrah", name: "Shiphrah", relationship: "The midwife who stood before Pharaoh.",
    evolutions: [
      cev(1, 4_000, 120, 90, "Throws explosive vials."),
      cev(2, 1_300_000, 180, 110, "Larger explosions."),
      cev(3, 3_300_000, 280, 130, "Chain explosions."),
    ],
  },
  {
    id: "gershom", name: "Gershom", relationship: "Moses' firstborn son, a stranger in a strange land.",
    evolutions: [
      cev(1, 9_000, 130, 100, "Archer."),
      cev(2, 1_700_000, 190, 120, "Fire archer."),
      cev(3, 4_200_000, 300, 140, "Fires three explosive fire arrows."),
    ],
  },
  {
    id: "eliezer", name: "Eliezer", relationship: "Moses' second son — my God is my help.",
    evolutions: [
      cev(1, 18_000, 150, 90, "Throws a piercing spear."),
      cev(2, 2_200_000, 220, 110, "Electric spear chains damage between seven nearby enemies."),
      cev(3, 5_400_000, 350, 130, "Electric spear chains damage between fifteen nearby enemies."),
    ],
  },
  {
    id: "jochebed", name: "Jochebed", relationship: "Moses' mother, who hid him in an ark of bulrushes.",
    evolutions: [
      cev(1, 27_000, 140, 130, "Throws water from a basket and hits several enemies."),
      cev(2, 2_800_000, 210, 160, "Large water jets push enemies."),
      cev(3, 6_900_000, 330, 200, "Summons a circular wave that damages and repels nearby enemies."),
    ],
  },
  {
    id: "amram", name: "Amram", relationship: "Moses' father, of the house of Levi.",
    evolutions: [
      cev(1, 45_000, 160, 140, "Throws a pyramid stone that cracks the ground and launches affected enemies away."),
      cev(2, 3_600_000, 240, 180, "Throws two stones."),
      cev(3, 8_800_000, 380, 230, "Throws three stones and creates a larger impact area."),
    ],
  },
  {
    id: "jethro", name: "Jethro", relationship: "Midianite priest, Moses' father-in-law and counselor.",
    evolutions: [
      cev(1, 70_000, 100, 180, "Every 12 seconds, converts one nearby enemy into an ally for 10 seconds. Cannot affect Ramses."),
      cev(2, 4_500_000, 170, 230, "Can confuse nearby enemies every 8 seconds."),
      cev(3, 11_000_000, 280, 300, "Confuses nearby enemies every 4 seconds for 10 seconds."),
    ],
  },
  {
    id: "ithamar", name: "Ithamar", relationship: "Aaron's youngest son, keeper of the tabernacle.",
    evolutions: [
      cev(1, 100_000, 120, 200, "Does not attack. Creates a temporary shield for himself and the nearest ally or Moses that keeps melee enemies out; breaks after two hits."),
      cev(2, 5_500_000, 190, 260, "Shield lasts longer and absorbs five hits, including projectiles and flying animals."),
      cev(3, 13_500_000, 310, 340, "Shield lasts longer and breaks after eight hits."),
    ],
  },
  {
    id: "nadab", name: "Nadab", relationship: "Aaron's firstborn, who offered fire before the LORD.",
    evolutions: [
      cev(1, 130_000, 200, 110, "Throws a fireball that explodes on the first enemy hit and damages an area."),
      cev(2, 6_700_000, 290, 140, "Fires a line of piercing flame."),
      cev(3, 16_500_000, 450, 170, "Fires flames that rebound between enemies."),
    ],
  },
  {
    id: "abihu", name: "Abihu", relationship: "Aaron's second son, consecrated to the fire.",
    evolutions: [
      cev(1, 180_000, 220, 120, "Creates a ring of fire around himself."),
      cev(2, 8_000_000, 320, 150, "Constantly flees while leaving a damaging fire trail."),
      cev(3, 20_000_000, 500, 190, "Larger fire ring and damaging fire trail."),
    ],
  },
  {
    id: "eleazar", name: "Eleazar", relationship: "Aaron's son, priest after his father.",
    evolutions: [
      cev(1, 250_000, 250, 140, "Fires a continuous beam of light that damages enemies it touches."),
      cev(2, 10_000_000, 370, 180, "Fires three continuous beams."),
      cev(3, 25_000_000, 580, 230, "Fires five continuous beams."),
    ],
  },
  {
    id: "aaron", name: "Aaron", relationship: "Moses' brother and spokesman, the high priest.",
    evolutions: [
      cev(1, 500_000, 300, 220, "Blows a horn that pushes enemies away."),
      cev(2, 13_000_000, 450, 280, "Adds three pixel-art birds that assist him."),
      cev(3, 32_000_000, 700, 350, "Stronger knockback and nine assisting birds."),
    ],
  },
];

export const CATEGORY_ITEMS: Record<ShopCategory, EquipItem[]> = {
  weapon: WEAPONS,
  staff: STAFFS,
  food: FOODS,
  shield: SHIELDS,
  footwear: FOOTWEAR,
};

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  weapon: "Weapons",
  staff: "Staffs",
  food: "Food / Max Health",
  shield: "Shields",
  footwear: "Footwear",
};

export function findItem(id: string): EquipItem | undefined {
  for (const list of Object.values(CATEGORY_ITEMS)) {
    const found = list.find((i) => i.id === id);
    if (found) return found;
  }
  return undefined;
}

export function findChampion(id: string): ChampionDef | undefined {
  return CHAMPIONS.find((c) => c.id === id);
}

export function formatCoins(n: number): string {
  return n.toLocaleString("en-US");
}
