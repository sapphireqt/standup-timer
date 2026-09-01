"use client";

import { useState, useSyncExternalStore } from "react";

const WATCH_STORAGE_KEY = "daily-standup:watch:v1";
const WATCH_CHANGE_EVENT = "daily-standup:watch-changed";

type WatchValue = {
  url: string;
  vertical: boolean;
};

const DEFAULT_WATCH: WatchValue = {
  url: "https://www.youtube.com/watch?v=zZ7AimPACzc",
  vertical: true,
};

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function extractYouTubeId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const pathMatch = url.pathname.match(
        /^\/(shorts|embed|live)\/([\w-]{11})/,
      );
      if (pathMatch) {
        return pathMatch[2];
      }
    }
  } catch {
    return null;
  }

  return null;
}

function parseWatchValue(raw: string | null): WatchValue | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WatchValue>;
    if (typeof parsed.url === "string" && parsed.url) {
      return {
        url: parsed.url,
        vertical: Boolean(parsed.vertical),
      };
    }
  } catch {
    // Legacy value from before the vertical toggle existed: a bare URL string.
    if (extractYouTubeId(raw)) {
      return { url: raw, vertical: false };
    }
  }

  return null;
}

function getWatchSnapshot(): string | null {
  try {
    return window.localStorage.getItem(WATCH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeToWatch(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(WATCH_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(WATCH_CHANGE_EVENT, onStoreChange);
  };
}

function saveWatchValue(value: WatchValue): void {
  window.localStorage.setItem(WATCH_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(WATCH_CHANGE_EVENT));
}

export default function WatchPanel() {
  const hasHydrated = useHasHydrated();
  const storedSnapshot = useSyncExternalStore(
    subscribeToWatch,
    getWatchSnapshot,
    () => null,
  );
  // Bumped only on Reset, so the uncontrolled input remounts with the
  // default text. Normal typing/pasting must NOT remount the input, or
  // every keystroke after a valid link is recognized would reset focus.
  const [resetToken, setResetToken] = useState(0);

  if (!hasHydrated) {
    return <aside className="watch-panel" aria-hidden="true" />;
  }

  const active = parseWatchValue(storedSnapshot) ?? DEFAULT_WATCH;
  const videoId = extractYouTubeId(active.url);

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!extractYouTubeId(value)) {
      return;
    }

    const looksLikeShort = /\/shorts\//.test(value);
    saveWatchValue({
      url: value.trim(),
      vertical: looksLikeShort || active.vertical,
    });
  };

  const handleToggleVertical = () => {
    saveWatchValue({ url: active.url, vertical: !active.vertical });
  };

  const handleReset = () => {
    saveWatchValue(DEFAULT_WATCH);
    setResetToken((token) => token + 1);
  };

  return (
    <aside className="watch-panel" aria-label="Standup background video">
      <div className={`watch-frame${active.vertical ? " is-vertical" : ""}`}>
        {videoId ? (
          <iframe
            key={videoId}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1&rel=0`}
            title="Standup background video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="watch-empty">
            That link doesn&apos;t look like a YouTube video.
          </div>
        )}
      </div>

      <div className="watch-controls">
        <input
          aria-label="YouTube link"
          defaultValue={active.url}
          inputMode="url"
          key={resetToken}
          onChange={handleUrlChange}
          placeholder="Paste a YouTube link"
          type="url"
        />
        <button
          aria-pressed={active.vertical}
          className={`watch-vertical-toggle${
            active.vertical ? " is-active" : ""
          }`}
          onClick={handleToggleVertical}
          title="Toggle vertical framing"
          type="button"
        >
          Vertical
        </button>
        <button
          className="watch-reset-button"
          onClick={handleReset}
          type="button"
        >
          Reset
        </button>
      </div>
    </aside>
  );
}
