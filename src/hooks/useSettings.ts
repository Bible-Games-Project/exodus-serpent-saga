import { useEffect, useState } from "react";

export type Settings = {
  language: "en";
  /** Master sound switch. */
  volume: boolean;
  /** 0-100 volume level, used when sound is on. */
  volumeLevel: number;
  /** 0-100 sound effects volume (under the master volume). */
  sfxVolume: number;
  /** 0-100 music volume (under the master volume). */
  musicVolume: number;
  /** 0-100 volume of previews in Test Map → Sound testing. */
  previewVolume: number;
};

/** Fired on window whenever the settings are saved (the audio manager listens). */
export const SETTINGS_EVENT = "exodus-survivors:settings-changed";

const KEY = "exodus-survivors:settings";
const DEFAULT: Settings = { language: "en", volume: true, volumeLevel: 70, sfxVolume: 80, musicVolume: 60, previewVolume: 80 };


export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT;
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(DEFAULT);
  useEffect(() => {
    setS(loadSettings());
  }, []);
  const update = (patch: Partial<Settings>) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };
  return [s, update];
}
