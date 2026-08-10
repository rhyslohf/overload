import { useEffect, useState } from 'react';
import Button from '../../components/Button';
import { useStorage } from '../../components/StorageProvider';
import type { WorkoutSession } from '../../types/models';
import { formatLoggedSet } from '../../utils/formatSet';

interface SessionDetailProps {
  sessionId: string;
  onBack: () => void;
}

const STATUS_LABEL: Record<WorkoutSession['status'], string> = {
  inProgress: 'In progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

function formatDateTime(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/**
 * Read-only detail of one finished workout session (Phase 5). Renders the
 * session's own fact-table snapshot — exercise names and per-set logs
 * (weight/reps/difficulty, myorep mini-set counts, skipped markers) — so it
 * survives even if the source routine is later edited or deleted.
 */
function SessionDetail({ sessionId, onBack }: SessionDetailProps) {
  const storage = useStorage();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void storage.getSession(sessionId).then((result) => {
      if (cancelled) return;
      setSession(result);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage, sessionId]);

  if (!loaded) {
    return <p className="text-sm text-ink-2">Loading…</p>;
  }

  if (session == null) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="secondary" onClick={onBack}>
          ← Back to history
        </Button>
        <p className="text-sm text-ink-2">This session no longer exists.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm text-ink-2 transition-colors duration-100 hover:text-ink"
        >
          ← History
        </button>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{session.routineName}</h1>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
              session.status === 'abandoned'
                ? 'border-line bg-raise text-ink-2'
                : 'border-accent/40 bg-accent/10 text-accent-hi'
            }`}
          >
            {STATUS_LABEL[session.status]}
          </span>
        </div>
        <p className="text-sm text-ink-2">
          Started {formatDateTime(session.startedAt)}
        </p>
        <p className="text-sm text-ink-2">
          Finished {formatDateTime(session.completedAt)}
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {session.exercises.map((exercise) => {
          const skippedCount = exercise.skippedSetDefIds?.length ?? 0;
          return (
            <li
              key={exercise.id}
              className="rounded-lg border border-line bg-panel p-3"
            >
              <h2 className="font-semibold">{exercise.name}</h2>
              {exercise.sets.length === 0 && skippedCount === 0 ? (
                <p className="mt-1 text-sm text-ink-3">No sets logged.</p>
              ) : (
                <ol className="mt-2 flex flex-col gap-1">
                  {exercise.sets.map((set) => (
                    <li key={set.id} className="text-sm tabular-nums text-ink">
                      Set {set.order + 1} · {formatLoggedSet(set)}
                      {set.myorepMiniSets && set.myorepMiniSets.length > 0 && (
                        <ul className="mt-0.5 flex flex-col gap-0.5 text-ink-2">
                          {set.myorepMiniSets.map((mini, i) => (
                            <li key={i}>
                              Mini-set {i + 1} · {mini.reps} reps
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                  {skippedCount > 0 && (
                    <li className="text-sm text-ink-3">
                      {skippedCount} skipped
                    </li>
                  )}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default SessionDetail;
