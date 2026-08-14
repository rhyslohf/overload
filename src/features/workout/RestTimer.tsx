import { useEffect, useState } from 'react';

interface RestTimerProps {
  /** When non-null the clock runs from this instant (controlled by the parent
   * so the timer survives moving with the active exercise during a workout). */
  runningSince: number | null;
  /** Tap = restart from now (§4.3) — ask the parent to start a fresh rest. */
  onTap: () => void;
  targetRestSeconds?: number;
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Rest Timer (§4.3). One large thumb-friendly button — no stopwatch "lap".
 *   - Idle → tap to start counting up from 0:00.
 *   - Running → tap to reset to 0:00 and immediately keep running.
 * Never persisted — a live UI aid only. The parent owns `runningSince` so the
 * timer can be repositioned above the active exercise without losing time.
 */
function RestTimer({ runningSince, onTap, targetRestSeconds }: RestTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (runningSince == null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [runningSince]);

  const running = runningSince != null;
  const elapsedMs = running ? Math.max(0, now - runningSince) : 0;
  const elapsed = Math.floor(elapsedMs / 1000);
  const overTarget = targetRestSeconds != null && elapsed > targetRestSeconds;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onTap}
        aria-label={
          running
            ? `Rest timer, ${formatSeconds(elapsed)}, running — tap to restart`
            : 'Rest timer, 0:00, idle — tap to start'
        }
        className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border py-7 transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-accent ${
          running
            ? 'border-accent/40 bg-accent/10'
            : 'border-line bg-panel hover:bg-raise active:bg-raise'
        }`}
      >
        <span
          className={`text-5xl font-semibold tabular-nums ${
            overTarget ? 'text-accent-hi' : 'text-ink'
          }`}
        >
          {formatSeconds(elapsed)}
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-ink-2">
          {running
            ? overTarget
              ? 'Rest over target'
              : 'Resting — tap to restart'
            : 'Rest — tap to start'}
        </span>
      </button>
      {targetRestSeconds != null && (
        <p className="text-center text-xs text-ink-3">
          Target rest {formatSeconds(targetRestSeconds)}
        </p>
      )}
    </div>
  );
}

export default RestTimer;
