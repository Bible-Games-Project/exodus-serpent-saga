// Preview sprites for the Test Map configuration screen. Each entry points at
// the same PNG layer the game itself draws, so the menu shows the real art.
// A kind with no entry simply falls back to a plain label in the UI.
import soldier from "@/assets/soldier-body.png.asset.json";
import jackal from "@/assets/dog-body.png.asset.json";
import archer from "@/assets/archer-body.png.asset.json";
import axesoldier from "@/assets/axe-body.png.asset.json";
import shieldsoldier from "@/assets/shield-body.png.asset.json";
import bat from "@/assets/bat-body.png.asset.json";
import heavysoldier from "@/assets/armored-soldier-source.png.asset.json";
import wolf from "@/assets/wolf-body.png.asset.json";
import agilesoldier from "@/assets/agile-body.png.asset.json";
import cobra from "@/assets/cobra-head.png.asset.json";
import spearsoldier from "@/assets/spear-soldier-source.png.asset.json";
import camel from "@/assets/camel-body.png.asset.json";
import lion from "@/assets/lion-body.png.asset.json";
import spearknight from "@/assets/knight-body.png.asset.json";
import mage from "@/assets/mage-body.png.asset.json";
import chariotarcher from "@/assets/chariot-body.png.asset.json";
import ramses from "@/assets/ramses-body.png.asset.json";

const SPRITES: Record<string, string> = {
  soldier: soldier.url,
  jackal: jackal.url,
  archer: archer.url,
  axesoldier: axesoldier.url,
  shieldsoldier: shieldsoldier.url,
  bat: bat.url,
  heavysoldier: heavysoldier.url,
  wolf: wolf.url,
  agilesoldier: agilesoldier.url,
  cobra: cobra.url,
  spearsoldier: spearsoldier.url,
  camel: camel.url,
  lion: lion.url,
  spearknight: spearknight.url,
  mage: mage.url,
  chariotarcher: chariotarcher.url,
  ramses: ramses.url,
};

export function enemySpriteUrl(kind: string): string | undefined {
  return SPRITES[kind];
}
