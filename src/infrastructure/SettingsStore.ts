/**
 * SettingsStore – Persists application settings to localStorage.
 *
 * Each settings group is stored as a separate key to allow
 * independent load/save without touching unrelated groups.
 */

const PREFIX = 'wsm:';

export const SettingsStore = {
  load<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  save(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable – silently ignore.
    }
  },
} as const;
