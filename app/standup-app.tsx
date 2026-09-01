"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  durationToMilliseconds,
  getSettingsSnapshot,
  parseSettingsSnapshot,
  StandupSettings,
  subscribeToSettings,
} from "@/lib/standup-settings";
import WatchPanel from "./watch-panel";

const pagesBasePath = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? "";
const settingsPath = `${pagesBasePath}/settings/`;

type ParticipantTimer = {
  id: string;
  name: string;
  remainingMs: number;
  hasStarted: boolean;
};

const confettiPieces = Array.from({ length: 56 }, (_, index) => ({
  color: ["#d8ff63", "#ffcb67", "#ff7d8d", "#78dfff", "#f7f8f2"][
    index % 5
  ],
  delay: `${(index % 14) * 0.045}s`,
  drift: `${((index * 37) % 180) - 90}px`,
  duration: `${1.9 + (index % 7) * 0.14}s`,
  left: `${(index * 47) % 100}%`,
  rotation: `${180 + (index % 8) * 90}deg`,
}));

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function formatTime(milliseconds: number): string {
  const totalCentiseconds = Math.ceil(milliseconds / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  return [minutes, seconds, centiseconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {confettiPieces.map((piece, index) => (
        <span
          className="confetti-piece"
          key={index}
          style={
            {
              "--confetti-color": piece.color,
              "--confetti-delay": piece.delay,
              "--confetti-drift": piece.drift,
              "--confetti-duration": piece.duration,
              "--confetti-left": piece.left,
              "--confetti-rotation": piece.rotation,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function StandupTimer({ settings }: { settings: StandupSettings }) {
  const [timers, setTimers] = useState<ParticipantTimer[]>(() => {
    const durationMs = durationToMilliseconds(settings.durationMinutes);
    return shuffle(settings.users).map((name, index) => ({
      id: `${index}-${crypto.randomUUID()}`,
      name,
      remainingMs: durationMs,
      hasStarted: false,
    }));
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const timersRef = useRef<ParticipantTimer[]>(timers);
  const activeIdRef = useRef<string | null>(null);
  const deadlineRef = useRef<number | null>(null);

  const commitTimers = useCallback((nextTimers: ParticipantTimer[]) => {
    timersRef.current = nextTimers;
    setTimers(nextTimers);
  }, []);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    let animationFrame = 0;

    const tick = (now: number) => {
      const deadline = deadlineRef.current;
      if (deadline === null || activeIdRef.current !== activeId) {
        return;
      }

      const remainingMs = Math.max(0, deadline - now);
      const nextTimers = timersRef.current.map((timer) =>
        timer.id === activeId ? { ...timer, remainingMs } : timer,
      );
      commitTimers(nextTimers);

      if (remainingMs === 0) {
        activeIdRef.current = null;
        deadlineRef.current = null;
        setActiveId(null);
        return;
      }

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeId, commitTimers]);

  const pauseActiveTimer = useCallback(() => {
    const currentActiveId = activeIdRef.current;
    const deadline = deadlineRef.current;
    if (!currentActiveId || deadline === null) {
      return;
    }

    const remainingMs = Math.max(0, deadline - performance.now());
    commitTimers(
      timersRef.current.map((timer) =>
        timer.id === currentActiveId ? { ...timer, remainingMs } : timer,
      ),
    );
    activeIdRef.current = null;
    deadlineRef.current = null;
    setActiveId(null);
  }, [commitTimers]);

  const startTimer = useCallback(
    (id: string) => {
      const now = performance.now();
      const previousActiveId = activeIdRef.current;
      const previousDeadline = deadlineRef.current;
      let nextTimers = timersRef.current;

      if (previousActiveId && previousDeadline !== null) {
        const previousRemainingMs = Math.max(0, previousDeadline - now);
        nextTimers = nextTimers.map((timer) =>
          timer.id === previousActiveId
            ? { ...timer, remainingMs: previousRemainingMs }
            : timer,
        );
      }

      const selectedTimer = nextTimers.find((timer) => timer.id === id);
      if (!selectedTimer || selectedTimer.remainingMs <= 0) {
        commitTimers(nextTimers);
        return;
      }

      nextTimers = nextTimers.map((timer) =>
        timer.id === id ? { ...timer, hasStarted: true } : timer,
      );
      commitTimers(nextTimers);
      activeIdRef.current = id;
      deadlineRef.current = now + selectedTimer.remainingMs;
      setActiveId(id);
    },
    [commitTimers],
  );

  const toggleTimer = useCallback(
    (id: string) => {
      if (activeIdRef.current === id) {
        pauseActiveTimer();
      } else {
        startTimer(id);
      }
    },
    [pauseActiveTimer, startTimer],
  );

  const finishStandup = useCallback(() => {
    const currentActiveId = activeIdRef.current;
    const deadline = deadlineRef.current;
    let nextTimers = timersRef.current;

    if (currentActiveId && deadline !== null) {
      const remainingMs = Math.max(0, deadline - performance.now());
      nextTimers = nextTimers.map((timer) =>
        timer.id === currentActiveId ? { ...timer, remainingMs } : timer,
      );
    }

    commitTimers(nextTimers);
    activeIdRef.current = null;
    deadlineRef.current = null;
    setActiveId(null);
    setShowResults(true);
  }, [commitTimers]);

  if (showResults) {
    const rankedTimers = timers
      .filter((timer) => timer.hasStarted)
      .sort((first, second) => second.remainingMs - first.remainingMs);

    return (
      <section className="results-card" aria-labelledby="results-heading">
        <Confetti />
        <p className="eyebrow">Standup complete</p>
        <h2 id="results-heading">Speed ranking</h2>
        <p className="results-copy">More time left means a higher place.</p>

        <ol className="ranking-list">
          {rankedTimers.map((timer, index) => (
            <li className={`ranking-row place-${index + 1}`} key={timer.id}>
              <span className="ranking-place">
                {index < 3 ? (
                  <span
                    aria-label={`${["Gold", "Silver", "Bronze"][index]} trophy`}
                    className={`trophy trophy-${index + 1}`}
                    role="img"
                  >
                    <span className="trophy-glyph">🏆</span>
                  </span>
                ) : (
                  index + 1
                )}
              </span>
              <span className="ranking-name">{timer.name}</span>
              <time>{formatTime(timer.remainingMs)}</time>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const hasParticipantsInTournament = timers.some((timer) => timer.hasStarted);

  return (
    <>
      <section className="participant-list" aria-label="Standup participants">
        {timers.map((timer) => {
          const isActive = activeId === timer.id;
          const isFinished = timer.remainingMs <= 0;
          const isTimerVisible = timer.hasStarted && !isActive;

          return (
            <article
              className={`participant-row${isActive ? " is-active" : ""}${
                isFinished ? " is-finished" : ""
              }`}
              key={timer.id}
            >
              <div className="participant-copy">
                <span className="status-dot" aria-hidden="true" />
                <h2 title={timer.name}>{timer.name}</h2>
              </div>
              <time
                aria-label={
                  isTimerVisible
                    ? `${timer.name}: ${formatTime(timer.remainingMs)}`
                    : `${timer.name}: timer hidden`
                }
              >
                <span
                  className={`timer-digits${
                    isTimerVisible ? "" : " is-concealed"
                  }`}
                >
                  {formatTime(timer.remainingMs)}
                </span>
              </time>
              <button
                aria-pressed={isActive}
                className="timer-button"
                disabled={isFinished}
                onClick={() => toggleTimer(timer.id)}
                type="button"
              >
                {isFinished ? "Finished" : isActive ? "Pause" : "Play"}
              </button>
            </article>
          );
        })}
      </section>

      <div className="standup-actions">
        <button
          className="finish-button"
          disabled={!hasParticipantsInTournament}
          onClick={finishStandup}
          type="button"
        >
          Done <span aria-hidden="true">🎉</span>
        </button>
        {!hasParticipantsInTournament && (
          <p>Start at least one timer to create a ranking.</p>
        )}
      </div>
    </>
  );
}

export default function StandupApp() {
  const hasHydrated = useHasHydrated();
  const settingsSnapshot = useSyncExternalStore(
    subscribeToSettings,
    getSettingsSnapshot,
    () => null,
  );
  const settings = parseSettingsSnapshot(settingsSnapshot);

  return (
    <main className="standup-shell">
      <header className="standup-header">
        <div>
          <p className="eyebrow">Team rhythm</p>
          <h1>Daily standup</h1>
        </div>
        <a className="settings-link" href={settingsPath}>
          Settings
        </a>
      </header>

      <div className="standup-layout">
        <div className="standup-main">
          {!hasHydrated && (
            <section className="state-card" aria-live="polite">
              <p className="state-kicker">One moment</p>
              <h2>Preparing the standup…</h2>
            </section>
          )}

          {hasHydrated && !settings && (
            <section className="state-card">
              <p className="state-kicker">No team yet</p>
              <h2>Set up your standup</h2>
              <p>
                Add the people taking part and choose how long each person
                gets.
              </p>
              <a className="primary-link" href={settingsPath}>
                Open settings
              </a>
            </section>
          )}

          {hasHydrated && settings && (
            <StandupTimer key={settingsSnapshot} settings={settings} />
          )}
        </div>

        <WatchPanel />
      </div>
    </main>
  );
}
