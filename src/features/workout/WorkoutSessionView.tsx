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
import { createLoggedSet, createSetDefinition } from '../../types/factories';
import { findPriorLoggedSet, suggestNext } from '../overload/suggest';
import RestTimer from './RestTimer';
import SetLogRow from './SetLogRow';

interface WorkoutSessionViewProps {
  sessionId: string;
  onBack: () => void;
  onFinish: (session: WorkoutSession) => void;
  onAbandon: (session: WorkoutSession) => void;
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
  onAbandon,
}: WorkoutSessionViewProps) {
  const storage = useStorage();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [plan, setPlan] = useState<PlanExercise[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Finished history for this routine — drives §4.6 suggestions.
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  // Unplanned sets added during the session (§4.2). Keyed by session exercise
  // index; each entry is a synthetic SetDefinition the row can log against.
  const [extras, setExtras] = useState<Record<number, SetDefinition[]>>({});
  // §4.3 (recommended): increment to auto-start a fresh rest per set log.
  const [restSignal, setRestSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void storage.getSession(sessionId).then((result) => {
      if (cancelled) return;
      setSession(result);
      if (result) {
        void Promise.all([
          storage.getRoutine(result.routineId),
          storage.listSessions(),
        ]).then(([routine, sessions]) => {
          if (cancelled) return;
          setPlan(planForSession(result, routine));
          setHistory(sessions);
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
    setRestSignal((n) => n + 1);
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
    setRestSignal((n) => n + 1);
  }

  // §4.2 "skip a planned one without breaking the session": record the setDefId
  // so the row collapses to a Skipped marker and autosaves with the session.
  function handleSkip(exerciseIndex: number, setDef: SetDefinition) {
    const next: WorkoutSession = {
      ...current,
      exercises: current.exercises.map((exercise, i) =>
        i === exerciseIndex
          ? {
              ...exercise,
              skippedSetDefIds: [
                ...(exercise.skippedSetDefIds ?? []),
                setDef.id,
              ],
            }
          : exercise,
      ),
    };
    setSession(next);
    void storage.upsertSession(next);
  }

  // §4.2 "add an unplanned extra set": append a blank row to that exercise only.
  function handleAddSet(exerciseIndex: number) {
    const planned = plannedSetsFor(exerciseIndex).length;
    const existing = extras[exerciseIndex]?.length ?? 0;
    setExtras({
      ...extras,
      [exerciseIndex]: [
        ...(extras[exerciseIndex] ?? []),
        createSetDefinition(planned + existing),
      ],
    });
  }

  // An unplanned set logs like a planned one; its synthetic id is its setDefId
  // and extra orders continue after the planned sets.
  function handleLogExtra(
    exerciseIndex: number,
    extra: SetDefinition,
    input: { weightKg: number; reps: number; difficulty: Difficulty },
  ) {
    appendLoggedSet(
      exerciseIndex,
      createLoggedSet({
        setDefId: extra.id,
        order: extra.order,
        weightKg: input.weightKg,
        reps: input.reps,
        difficulty: input.difficulty,
      }),
    );
    setExtras({
      ...extras,
      [exerciseIndex]: extras[exerciseIndex]?.filter((e) => e.id !== extra.id),
    });
  }

  function plannedSetsFor(exerciseIndex: number): SetDefinition[] {
    return plan[exerciseIndex]?.sets ?? [];
  }

  const plannedSets: Map<number, SetDefinition[]> = new Map();
  current.exercises.forEach((_, exerciseIndex) => {
    plannedSets.set(exerciseIndex, plan[exerciseIndex]?.sets ?? []);
  });

  const skippedFor = (exercise: LoggedExercise, set: SetDefinition) =>
    (exercise.skippedSetDefIds ?? []).includes(set.id);

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

      <RestTimer
        autoStartSignal={restSignal}
        targetRestSeconds={nextTargetRest(current.exercises, plan, skippedFor)}
      />

      <ol className="flex flex-col gap-3">
        {current.exercises.map((exercise, exerciseIndex) => {
          const sets = plannedSets.get(exerciseIndex) ?? [];
          const exerciseExtras = extras[exerciseIndex] ?? [];
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
                      {skippedFor(exercise, set) ? (
                        <div className="rounded-lg border border-line/70 bg-raise p-3">
                          <p className="text-sm font-medium text-ink-2">
                            Skipped
                          </p>
                        </div>
                      ) : (
                        <SetLogRow
                          set={set}
                          labelPrefix={`Set ${setIndex + 1}`}
                          sourceLoggedWeight={sourceWeightFor(exercise, set)}
                          logged={findLoggedSet(exercise, set)}
                          suggestion={suggestionFor(
                            exercise,
                            set,
                            current.routineId,
                            history,
                          )}
                          onLog={(input) =>
                            handleLog(exerciseIndex, set, input)
                          }
                          onAddMiniSet={(miniReps) =>
                            handleAddMiniSet(exerciseIndex, set, miniReps)
                          }
                          onSkip={() => handleSkip(exerciseIndex, set)}
                        />
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {exerciseExtras.length > 0 && (
                <ol className="mt-2 flex flex-col gap-2">
                  {exerciseExtras.map((extra) => (
                    <li
                      key={extra.id}
                      className="rounded-lg border border-dashed border-line bg-panel p-2"
                    >
                      <SetLogRow
                        set={extra}
                        labelPrefix="Extra"
                        sourceLoggedWeight={undefined}
                        logged={findLoggedSet(exercise, extra)}
                        onLog={(input) =>
                          handleLogExtra(exerciseIndex, extra, input)
                        }
                        onAddMiniSet={() => {}}
                      />
                    </li>
                  ))}
                </ol>
              )}
              <button
                type="button"
                onClick={() => handleAddSet(exerciseIndex)}
                className="mt-3 self-start rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-ink-2 transition-colors duration-100 hover:bg-raise"
              >
                + Add set
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex gap-2">
        <Button
          variant="danger"
          className="flex-1"
          onClick={() => onAbandon(session)}
        >
          Abandon session
        </Button>
        <Button className="flex-1" onClick={() => onFinish(session)}>
          Finish workout
        </Button>
      </div>
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

/**
 * §4.3 (optional): the first planned set that still has a rest to take — its
 * `targetRestSeconds` is the subtle reference. Only if it's not already done.
 */
function nextTargetRest(
  exercises: WorkoutSession['exercises'],
  plan: PlanExercise[],
  skippedFor: (exercise: LoggedExercise, set: SetDefinition) => boolean,
): number | undefined {
  for (let i = 0; i < exercises.length; i += 1) {
    const exercise = exercises[i];
    const sets = plan[i]?.sets ?? [];
    for (const set of sets) {
      if (set.targetRestSeconds == null) continue;
      if (findLoggedSet(exercise, set) != null) continue;
      if (skippedFor(exercise, set)) continue;
      return set.targetRestSeconds;
    }
  }
  return undefined;
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

/**
 * §4.6: suggested next weight/reps for a planned set, computed from the most
 * recent finished session of this routine for this exercise + set position.
 */
function suggestionFor(
  exercise: LoggedExercise,
  set: SetDefinition,
  routineId: string,
  history: WorkoutSession[],
) {
  const prior = findPriorLoggedSet(
    history,
    routineId,
    exercise.exerciseId,
    set.order,
  );
  return suggestNext(set, prior);
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
