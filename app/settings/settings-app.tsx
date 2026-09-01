"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  getSearchSnapshot,
  getSettingsSnapshot,
  normalizeSettings,
  parseUsers,
  parseSettingsSearch,
  parseSettingsSnapshot,
  replaceSearch,
  saveSettings,
  settingsToSearch,
  StandupSettings,
  subscribeToSearch,
  subscribeToSettings,
} from "@/lib/standup-settings";

const pagesBasePath = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? "";
const homePath = `${pagesBasePath}/`;
// Browsers throttle history writes, so keystrokes settle before the URL moves.
const URL_SYNC_DELAY_MS = 300;

function SettingsForm({ initialSettings }: { initialSettings: StandupSettings }) {
  const [usersValue, setUsersValue] = useState(
    initialSettings.users.join("\n"),
  );
  const [durationValue, setDurationValue] = useState(
    String(initialSettings.durationMinutes),
  );
  const [error, setError] = useState("");

  const draftSearch = settingsToSearch(
    normalizeSettings({
      version: 1,
      users: parseUsers(usersValue),
      durationMinutes: Number(durationValue),
    }),
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => replaceSearch(draftSearch),
      URL_SYNC_DELAY_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [draftSearch]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const users = parseUsers(usersValue);
    const durationMinutes = Number(durationValue);

    if (users.length === 0) {
      setError("Add at least one person.");
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError("Timer duration must be greater than zero.");
      return;
    }

    const settings: StandupSettings = { version: 1, users, durationMinutes };

    try {
      saveSettings(settings);
    } catch {
      // The link still carries the team, so keep going without local storage.
    }

    window.location.assign(`${homePath}${settingsToSearch(settings)}`);
  };

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Daily standup</p>
          <h1>Settings</h1>
        </div>
        <a className="settings-link" href={`${homePath}${draftSearch}`}>
          Back to standup
        </a>
      </header>

      <form className="settings-form" onSubmit={handleSubmit} noValidate>
        <label className="field-group" htmlFor="users">
          <span className="field-heading">Users</span>
          <span className="field-hint">One person per line</span>
          <textarea
            id="users"
            onChange={(event) => {
              setUsersValue(event.target.value);
              setError("");
            }}
            placeholder={"Alex Morgan\nSam Rivera\nJordan Lee"}
            rows={8}
            value={usersValue}
          />
        </label>

        <label className="field-group" htmlFor="timer-duration">
          <span className="field-heading">Timer duration</span>
          <span className="field-hint">Minutes per person</span>
          <div className="duration-input-wrap">
            <input
              id="timer-duration"
              inputMode="decimal"
              min="0.01"
              onChange={(event) => {
                setDurationValue(event.target.value);
                setError("");
              }}
              step="any"
              type="number"
              value={durationValue}
            />
            <span aria-hidden="true">min</span>
          </div>
        </label>

        <div className="form-footer">
          <div className="form-messages">
            <p className="field-hint">
              Every edit updates the page link. Share it to share this team.
            </p>
            <p className="form-error" role="alert">
              {error}
            </p>
          </div>
          <button className="save-button" type="submit">
            Save settings
          </button>
        </div>
      </form>
    </main>
  );
}

export default function SettingsApp() {
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const settingsSnapshot = useSyncExternalStore(
    subscribeToSettings,
    getSettingsSnapshot,
    () => null,
  );
  const searchSnapshot = useSyncExternalStore(
    subscribeToSearch,
    getSearchSnapshot,
    () => "",
  );
  // A shared link wins over whatever this browser happens to remember.
  const initialSettings =
    (hasHydrated &&
      (parseSettingsSearch(searchSnapshot) ??
        parseSettingsSnapshot(settingsSnapshot))) ||
    DEFAULT_SETTINGS;
  // Keyed on stored settings only: the form rewrites the URL while you type.
  const formKey = hasHydrated
    ? (settingsSnapshot ?? "browser-default")
    : "server-default";

  return <SettingsForm initialSettings={initialSettings} key={formKey} />;
}
