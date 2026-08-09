import { useEffect, useState } from 'react';
import Button from '../../components/Button';
import { useStorage } from '../../components/StorageProvider';
import type {
  Difficulty,
  LoggedExercise,
  Routine,
  RoutineExercise,
  SetDefinition,
  WorkoutSession,
} from '../../types/models';
import { createLoggedSet } from '../../types/factories';
import SetLogRow from './SetLogRow';

interface WorkoutSessionViewProps {
  sessionId: string;
  onBack: () => void;
  onFinish: (session: WorkoutSession) => void;
}

interface PlanExercise {
  exerciseId: string;
  name: string;
  order: number;
  sets: SetDefinition[];
}

/**
 * Live workout logging screen (Phase 3). The session is a snapshot taken at
 * start (§4.2); sets are logged against the routine's plan, and every log is
 * persisted immediately (§4.2 autosave).
 */
function WorkoutSessionView({
  sessionId,
  onBack,
  onFinish,
}: WorkoutSessionViewProps) {
  const storage = useStorage();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [plan, setPlan] = useState<PlanExercise[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void storage.getSession(sessionId).then((result) => {
      if (cancelled) return;
      setSession(result);
      if (result) {
        void storage.getRoutine(result.routineId).then((routine) => {
          if (cancelled) return;
          setPlan(planForSession(result, routine));
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

  const current: WorkoutSession = session;

  function handleLog(
    exerciseIndex: number,
    setDef: SetDefinition,
    input: { weightKg: number; reps: number; difficulty: Difficulty },
  ) {
    const logged = createLoggedSet({
      setDefId: setDef.id,
      order: setDef.order,
      weightKg: input.weightKg,
      reps: input.reps,
      difficulty: input.difficulty,
    });
    appendLoggedSet(exerciseIndex, logged);
  }

  // §4.2: myorep mini-sets are reps-only adds pinned to the already-logged
  // activation set of the same definition (weight = the activation's weight).
  function handleAddMiniSet(
    exerciseIndex: number,
    setDef: SetDefinition,
    reps: number,
  ) {
    const exercise = current.exercises[exerciseIndex];
    const existing = findLoggedSet(exercise, setDef);
    if (existing == null) return;
    const next: WorkoutSession = {
      ...current,
      exercises: current.exercises.map((exercise, i) =>
        i === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((s) =>
                s.setDefId === setDef.id
                  ? {
                      ...s,
                      myorepMiniSets: [...(s.myorepMiniSets ?? []), { reps }],
                    }
                  : s,
              ),
            }
          : exercise,
      ),
    };
    setSession(next);
    void storage.upsertSession(next);
  }

  function appendLoggedSet(
    exerciseIndex: number,
    logged: WorkoutSession['exercises'][number]['sets'][number],
  ) {
    const next: WorkoutSession = {
      ...current,
      exercises: current.exercises.map((exercise, i) =>
        i === exerciseIndex
          ? { ...exercise, sets: [...exercise.sets, logged] }
          : exercise,
      ),
    };
    setSession(next);
    void storage.upsertSession(next);
  }

  const plannedSets: Map<number, SetDefinition[]> = new Map();
  current.exercises.forEach((_, exerciseIndex) => {
    plannedSets.set(exerciseIndex, plan[exerciseIndex]?.sets ?? []);
  });

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
          <h1 className="text-2xl font-semibold">{current.routineName}</h1>
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent-hi">
            In progress
          </span>
        </div>
        <p className="text-sm text-ink-2">
          Started{' '}
          {new Date(current.startedAt).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {current.exercises.map((exercise, exerciseIndex) => {
          const sets = plannedSets.get(exerciseIndex) ?? [];
          return (
            <li
              key={exercise.id}
              className="rounded-lg border border-line bg-panel p-3"
            >
              <h2 className="font-semibold">{exercise.name}</h2>
              {sets.length === 0 ? (
                <p className="mt-1 text-sm text-ink-3">No sets planned.</p>
              ) : (
                <ol className="mt-2 flex flex-col gap-2">
                  {sets.map((set, setIndex) => (
                    <li key={set.id}>
                      <p className="pb-1 text-xs font-semibold text-ink-3">
                        Set {setIndex + 1}
                      </p>
                      <SetLogRow
                        set={set}
                        labelPrefix={`Set ${setIndex + 1}`}
                        sourceLoggedWeight={sourceWeightFor(
                          current.exercises[exerciseIndex],
                          set,
                        )}
                        logged={findLoggedSet(
                          current.exercises[exerciseIndex],
                          set,
                        )}
                        onLog={(input) => handleLog(exerciseIndex, set, input)}
                        onAddMiniSet={(miniReps) =>
                          handleAddMiniSet(exerciseIndex, set, miniReps)
                        }
                      />
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

/**
 * True if the exercise's logged sets match this set definition. The session
 * stores results by `setDefId`, so match on that (order for unplanned adds).
 */
function findLoggedSet(
  exercise: LoggedExercise,
  set: SetDefinition,
): WorkoutSession['exercises'][number]['sets'][number] | undefined {
  return exercise.sets.find((s) => s.setDefId === set.id);
}

/** Live percentage recompute needs the *logged* weight of the source set. */
function sourceWeightFor(
  exercise: LoggedExercise,
  set: SetDefinition,
): number | undefined {
  if (set.weightMode !== 'percentageOfSet' || set.percentageOf == null) {
    return undefined;
  }
  return exercise.sets.find((s) => s.setDefId === set.percentageOf?.sourceSetId)
    ?.weightKg;
}

/** Build the plan for a session: session exercises × the routine's set defs. */
function planForSession(
  session: WorkoutSession,
  routine: Routine | null,
): PlanExercise[] {
  return session.exercises.map((exercise) => {
    const source: RoutineExercise | undefined = routine?.exercises.find(
      (r) => r.id === exercise.id || r.order === exercise.order,
    );
    return {
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      order: exercise.order,
      sets: source?.sets ?? [],
    };
  });
}

export default WorkoutSessionView;
