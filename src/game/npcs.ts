import type { NpcDef, NpcId } from "./types";

// Companion unlock order — matches the game brief. After Elder of Israel,
// every extra 5 levels unlocks another Elder (handled in the engine).
export const NPC_ORDER: NpcId[] = [
  "bithiah",
  "aaron",
  "miriam",
  "jethro",
  "zipporah",
  "joshua",
  "hur",
  "elder",
];

export const NPCS: Record<NpcId, NpcDef> = {
  bithiah: { id: "bithiah", name: "Bithiah (Thermutis)", description: "The princess who drew Moses from the river." },
  aaron: { id: "aaron", name: "Aaron", description: "Moses' brother and spokesman. Steady staff." },
  miriam: { id: "miriam", name: "Miriam", description: "Prophetess of song. Rallies the camp." },
  jethro: { id: "jethro", name: "Jethro", description: "Midianite priest. Wise counselor." },
  zipporah: { id: "zipporah", name: "Zipporah", description: "Moses' wife. Fierce protector." },
  joshua: { id: "joshua", name: "Joshua", description: "Faithful captain of the host." },
  hur: { id: "hur", name: "Hur", description: "Holds up Moses' arms in battle." },
  elder: { id: "elder", name: "Elder of Israel", description: "One of the seventy elders." },
};
