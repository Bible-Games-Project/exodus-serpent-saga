import type { NpcDef, NpcId } from "./types";

// Companion unlock order — after Elder of Israel, every extra 5 levels
// unlocks another Elder (handled in the engine).
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
  bithiah: {
    id: "bithiah",
    name: "Bithiah (Thermutis)",
    description: "The princess who drew Moses from the Nile.",
    scripture: "Exodus 2:5-10 — Pharaoh's daughter drew the child from the river and called his name Moses.",
  },
  aaron: {
    id: "aaron",
    name: "Aaron",
    description: "Moses' brother and spokesman.",
    scripture: "Exodus 4:14-16 — Aaron shall be thy spokesman unto the people; he shall be to thee instead of a mouth.",
  },
  miriam: {
    id: "miriam",
    name: "Miriam",
    description: "Prophetess of song who watched over baby Moses.",
    scripture: "Exodus 15:20 — Miriam the prophetess took a timbrel in her hand; and all the women went out after her.",
  },
  jethro: {
    id: "jethro",
    name: "Jethro",
    description: "Midianite priest and wise counselor.",
    scripture: "Exodus 18:19 — Hearken now unto my voice, I will give thee counsel, and God shall be with thee.",
  },
  zipporah: {
    id: "zipporah",
    name: "Zipporah",
    description: "Moses' wife, daughter of Jethro.",
    scripture: "Exodus 2:21 — Moses was content to dwell with the man: and he gave Moses Zipporah his daughter.",
  },
  joshua: {
    id: "joshua",
    name: "Joshua",
    description: "Faithful captain of the host of Israel.",
    scripture: "Exodus 17:9-13 — Joshua discomfited Amalek and his people with the edge of the sword.",
  },
  hur: {
    id: "hur",
    name: "Hur",
    description: "Held up Moses' arms during the battle with Amalek.",
    scripture: "Exodus 17:12 — Aaron and Hur stayed up his hands, the one on the one side, and the other on the other side.",
  },
  elder: {
    id: "elder",
    name: "Elder of Israel",
    description: "One of the seventy elders who bore the burden with Moses.",
    scripture: "Numbers 11:16-17 — Gather unto me seventy men of the elders of Israel... and I will take of the spirit which is upon thee.",
  },
};
