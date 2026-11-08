// Preview sprites for the Test Map configuration screen. Each entry points at
// the same PNG layer the game itself draws, so the menu shows the real art.
// A kind with no entry simply falls back to a plain label in the UI.
import soldier from "@/assets/soldier-body.png";
import jackal from "@/assets/dog-body.png";
import archer from "@/assets/archer-body.png";
import axesoldier from "@/assets/axe-body.png";
import shieldsoldier from "@/assets/shield-green-source.png";
import bat from "@/assets/bat-body.png";
import heavysoldier from "@/assets/heavy-new-source.png";
import wolf from "@/assets/wolf-body.png";
import agilesoldier from "@/assets/agile-new-source.png";
import cobra from "@/assets/cobra-head.png";
import spearsoldier from "@/assets/spear-v2-source.png";
import camel from "@/assets/camel-body.png";
import lion from "@/assets/lion-body.png";
import spearknight from "@/assets/mounted-new-source.png";
import mage from "@/assets/mage-red-source.png";
import chariotarcher from "@/assets/chariot-v2-source.png";
import ramses from "@/assets/ramses-quiet-body.png";

const SPRITES: Record<string, string> = {
  soldier: soldier,
  jackal: jackal,
  archer: archer,
  axesoldier: axesoldier,
  shieldsoldier: shieldsoldier,
  bat: bat,
  heavysoldier: heavysoldier,
  wolf: wolf,
  agilesoldier: agilesoldier,
  cobra: cobra,
  spearsoldier: spearsoldier,
  camel: camel,
  lion: lion,
  spearknight: spearknight,
  mage: mage,
  chariotarcher: chariotarcher,
  ramses: ramses,
};

export function enemySpriteUrl(kind: string): string | undefined {
  return SPRITES[kind];
}
