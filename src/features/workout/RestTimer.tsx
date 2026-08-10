import { useEffect, useRef, useState } from 'react';

interface RestTimerProps {
  targetRestSeconds?: number;
  /** Increment to auto-start a fresh rest (§4.3 recommended) — e.g. each set log. */
  autoStartSignal?: number;
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Rest Timer (§4.3). One large thumb-friendly button — no stopwatch "lap".
 *   - Tap while idle → starts counting up from 0:00.
 *   - Tap while running → resets to 0:00 and immediately keeps running.
 * Never persisted — a live UI aid only. Arrives at 0:00 by starting (or
 * restarting) the clock from "now", so a tap is always "restart from zero".
 */
function RestTimer({ targetRestSeconds, autoStartSignal = 0 }: RestTimerProps) {
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seenSignal = useRef(0);

  useEffect(() => {
    if (runningSince == null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [runningSince]);

  // §4.3 (recommended): a fresh rest starts automatically on each set log.
  useEffect(() => {
    if (autoStartSignal !== seenSignal.current) {
      seenSignal.current = autoStartSignal;
      const started = Date.now();
      setRunningSince(started);
      setNow(started);
    }
  }, [autoStartSignal]);

  const running = runningSince != null;
  const elapsedMs = running ? Math.max(0, now - runningSince) : 0;
  const elapsed = Math.floor(elapsedMs / 1000);
  const overTarget = targetRestSeconds != null && elapsed > targetRestSeconds;

  function handleTap() {
    const started = Date.now();
    setRunningSince(started);
    setNow(started);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleTap}
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
