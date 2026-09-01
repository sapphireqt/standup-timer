export const SETTINGS_STORAGE_KEY = "daily-standup:settings:v1";
export const USER_PARAM = "u";
export const DURATION_PARAM = "min";
const SETTINGS_CHANGE_EVENT = "daily-standup:settings-changed";
const SEARCH_CHANGE_EVENT = "daily-standup:search-changed";

export type StandupSettings = {
  version: 1;
  users: string[];
  durationMinutes: number;
};

export const DEFAULT_SETTINGS: StandupSettings = {
  version: 1,
  users: [],
  durationMinutes: 2,
};

export function parseUsers(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function normalizeSettings(value: unknown): StandupSettings | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StandupSettings>;
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.users) ||
    typeof candidate.durationMinutes !== "number" ||
    !Number.isFinite(candidate.durationMinutes) ||
    candidate.durationMinutes <= 0
  ) {
    return null;
  }

  const users = candidate.users
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.trim())
    .filter(Boolean);

  if (users.length === 0) {
    return null;
  }

  return {
    version: 1,
    users,
    durationMinutes: candidate.durationMinutes,
  };
}

export function getSettingsSnapshot(): string | null {
  try {
    return window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseSettingsSnapshot(
  rawValue: string | null,
): StandupSettings | null {
  if (!rawValue) {
    return null;
  }

  try {
    return normalizeSettings(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function subscribeToSettings(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SETTINGS_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SETTINGS_CHANGE_EVENT, onStoreChange);
  };
}

export function saveSettings(settings: StandupSettings): void {
  const serialized = JSON.stringify(settings);

  // Callers sync from a render effect, so writing the same value must stay a
  // no-op instead of looping through the change event.
  if (window.localStorage.getItem(SETTINGS_STORAGE_KEY) === serialized) {
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
  window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
}

// URLSearchParams percent-encodes UTF-8, so emoji, non-latin names, and
// separators such as "&" or "=" survive a trip through the address bar.
export function settingsToSearch(settings: StandupSettings | null): string {
  if (!settings) {
    return "";
  }

  const params = new URLSearchParams();
  for (const name of settings.users) {
    params.append(USER_PARAM, name);
  }
  params.set(DURATION_PARAM, String(settings.durationMinutes));

  return `?${params}`;
}

export function parseSettingsSearch(search: string): StandupSettings | null {
  const params = new URLSearchParams(search);
  const durationMinutes = Number(params.get(DURATION_PARAM));

  return normalizeSettings({
    version: 1,
    users: params.getAll(USER_PARAM),
    durationMinutes:
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes
        : DEFAULT_SETTINGS.durationMinutes,
  });
}

export function getSearchSnapshot(): string {
  return window.location.search;
}

export function subscribeToSearch(onStoreChange: () => void): () => void {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(SEARCH_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(SEARCH_CHANGE_EVENT, onStoreChange);
  };
}

export function replaceSearch(search: string): void {
  const { hash, pathname, search: currentSearch } = window.location;
  if (currentSearch === search) {
    return;
  }

  try {
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${search}${hash}`,
    );
  } catch {
    // Sandboxed frames and rate limited history writes must not break the page.
    return;
  }

  window.dispatchEvent(new Event(SEARCH_CHANGE_EVENT));
}

export function durationToMilliseconds(durationMinutes: number): number {
  return Math.round(durationMinutes * 60_000);
}
