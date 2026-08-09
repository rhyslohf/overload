import { useEffect, useState } from 'react';
import Button from '../../components/Button';
import { useStorage } from '../../components/StorageProvider';
import type { Routine, WorkoutSession } from '../../types/models';
import { formatSetDefinition } from '../../utils/formatSet';

interface WorkoutSessionViewProps {
  sessionId: string;
  onBack: () => void;
  onFinish: (session: WorkoutSession) => void;
}

/**
 * Live workout logging screen (Phase 3). The session is a snapshot taken
 * when the run started (§4.2); the routine is loaded only to render the
 * planned sets alongside what's logged so far.
 */
function WorkoutSessionView({
  sessionId,
  onBack,
  onFinish,
}: WorkoutSessionViewProps) {
  const storage = useStorage();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void storage.getSession(sessionId).then((result) => {
      if (cancelled) return;
      setSession(result);
      if (result) {
        void storage.getRoutine(result.routineId).then((r) => {
          if (cancelled) return;
          setRoutine(r);
          setLoaded(true);
        });
      } else {
        setLoaded(true);
      }
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
          ← Back to routines
        </Button>
        <p className="text-sm text-ink-2">This workout no longer exists.</p>
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
          ← Routines
        </button>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{session.routineName}</h1>
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent-hi">
            In progress
          </span>
        </div>
        <p className="text-sm text-ink-2">
          Started{' '}
          {new Date(session.startedAt).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {session.exercises.map((exercise) => {
          const plan = routine?.exercises.find(
            (r) => r.id === exercise.id || r.order === exercise.order,
          );
          return (
            <li
              key={exercise.id}
              className="rounded-lg border border-line bg-panel p-3"
            >
              <h2 className="font-semibold">{exercise.name}</h2>
              {plan == null || plan.sets.length === 0 ? (
                <p className="mt-1 text-sm text-ink-3">No sets planned.</p>
              ) : (
                <ol className="mt-2 flex flex-col gap-1">
                  {plan.sets.map((set) => (
                    <li key={set.id} className="text-sm text-ink-2">
                      {set.order + 1}. {formatSetDefinition(set)}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ol>

      <Button className="w-full" onClick={() => onFinish(session)}>
        Finish workout
      </Button>
    </div>
  );
}

export default WorkoutSessionView;
