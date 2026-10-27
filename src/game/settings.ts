// Player-facing settings, persisted in localStorage.
// Note: effect fidelity is *not* a user setting — the engine measures frame cost and adapts
// its own particle/LOD budget, so nobody has to tune a slider to get a smooth run.
export interface Settings {
  volume: number;
  shake: boolean;
  flashes: boolean;
  /** Free to play: every sheet is open from the start (progress & stars stay untouched). */
  freePlay: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  shake: true,
  flashes: true,
  freePlay: false,
};

const KEY = "ink-arena-settings-v2";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
