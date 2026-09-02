export const SETTINGS_STORAGE_KEY = "daily-standup:settings:v1";
export const TEAM_PARAM = "t";
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

// btoa only speaks Latin-1, so the team goes through UTF-8 bytes first. That is
// what keeps emoji and non-latin names intact. The base64url alphabet then needs
// no percent escaping, so the whole team travels as one compact query value.
function toBase64Url(value: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(value)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // A truncated or hand-mangled link decodes to nothing rather than mojibake.
    return null;
  }
}

export function settingsToSearch(settings: StandupSettings | null): string {
  if (!settings) {
    return "";
  }

  return `?${TEAM_PARAM}=${toBase64Url(JSON.stringify(settings))}`;
}

export function parseSettingsSearch(search: string): StandupSettings | null {
  const params = new URLSearchParams(search);
  const encodedTeam = params.get(TEAM_PARAM);
  const team = encodedTeam ? fromBase64Url(encodedTeam) : null;
  const settings = team ? parseSettingsSnapshot(team) : null;

  if (settings) {
    return settings;
  }

  // Readable links stay welcome: "?u=Alex&u=Sam&min=2" still opens a standup.
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
