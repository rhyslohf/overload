import Button from '../../components/Button';
import { useStorage } from '../../components/StorageProvider';
import type { Routine } from '../../types/models';
import { useEffect, useState } from 'react';

interface RoutineDetailProps {
  routineId: string;
  onBack: () => void;
}

function formatSet(set: Routine['exercises'][number]['sets'][number]): string {
  const reps = set.targetRepsMax
    ? `${set.targetReps}–${set.targetRepsMax}`
    : `${set.targetReps}`;
  const weight = set.targetWeightKg != null ? `${set.targetWeightKg} kg` : '—';
  return set.toFailure ? `${reps} reps to failure` : `${reps} × ${weight}`;
}

/**
 * Read-only view of a single saved routine (name, description, exercises,
 * sets). Phase 1 item 6 — "select one" lands here; edit & delete buttons
 * arrive in item 7.
 */
function RoutineDetail({ routineId, onBack }: RoutineDetailProps) {
  const storage = useStorage();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void storage.getRoutine(routineId).then((result) => {
      if (cancelled) return;
      setRoutine(result);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage, routineId]);

  if (!loaded) {
    return <p className="text-sm text-ink-2">Loading…</p>;
  }

  if (routine == null) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="secondary" onClick={onBack}>
          ← Back to routines
        </Button>
        <p className="text-sm text-ink-2">This routine no longer exists.</p>
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
        <h1 className="text-2xl font-semibold">{routine.name}</h1>
        {routine.description && (
          <p className="text-sm text-ink-2">{routine.description}</p>
        )}
      </div>

      <ol className="flex flex-col gap-3">
        {routine.exercises.map((exercise) => (
          <li
            key={exercise.id}
            className="rounded-lg border border-line bg-panel p-3"
          >
            <h2 className="font-semibold">{exercise.name}</h2>
            {exercise.sets.length === 0 ? (
              <p className="mt-1 text-sm text-ink-3">No sets.</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1">
                {exercise.sets.map((set) => (
                  <li key={set.id} className="text-sm text-ink-2">
                    {set.order + 1}. {formatSet(set)}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default RoutineDetail;
