import { useEffect, useState } from "react";

export type Settings = {
  language: "en";
  volume: boolean;
  devMode: boolean;
};

const KEY = "exodus-survivors:settings";
const DEFAULT: Settings = { language: "en", volume: true, devMode: false };

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
