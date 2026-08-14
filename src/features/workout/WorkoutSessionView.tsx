import { useEffect, useRef, useState } from 'react';
import Button from '../../components/Button';
import LoadError from '../../components/LoadError';
import { useSettings } from '../../components/SettingsProvider';
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

/** Ms since the epoch. Module scope so `Date.now()` isn't called in render. */
function nowMs(): number {
  return Date.now();
}

/**
 * Live workout logging screen (Phase 3). The session is a snapshot taken at
 * start (§4.2); sets are logged against the routine's plan, and every log is
 * persisted immediately (§4.2 autosave).
 *
 * Focused flow: only the active exercise is open — the rest collapse to their
 * headers. When the open exercise's last set is done it auto-collapses and the
 * next unfinished exercise expands, and the rest timer stays pinned right
 * above the active exercise so it travels with the routine (§ collapse).
 */
function WorkoutSessionView({
  sessionId,
  onBack,
  onFinish,
  onAbandon,
}: WorkoutSessionViewProps) {
  const storage = useStorage();
  const { settings } = useSettings();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [plan, setPlan] = useState<PlanExercise[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Finished history for this routine — drives §4.6 suggestions.
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  // Unplanned sets added during the session (§4.2). Keyed by session exercise
  // index; each entry is a synthetic SetDefinition the row can log against.
  const [extras, setExtras] = useState<Record<number, SetDefinition[]>>({});
  // Which exercise's card is open (§ focus). One at a time; null = all closed.
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  // Myorep sets keep their mini-set adder until the user marks them done — the
  // exercise only counts as finished once that happens.
  const [myorepDoneSetDefIds, setMyorepDoneSetDefIds] = useState<string[]>([]);
  // Rest timer state lives here so the timer survives moving between exercises.
  const [restRunningSince, setRestRunningSince] = useState<number | null>(null);
  const previousDone = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void storage
      .getSession(sessionId)
      .then((result) => {
        if (cancelled) return;
        setSession(result);
        if (result) {
          return Promise.all([
            storage.getRoutine(result.routineId),
            storage.listSessions(),
          ]).then(([routine, sessions]) => {
            if (cancelled) return;
            const planForResult = planForSession(result, routine);
            setPlan(planForResult);
            setHistory(sessions);
            // § focus: open the first exercise that still has work. Set here
            // (batched with `loaded`) so the very first painted frame is open.
            setExpandedIndex(firstOpenExercise(result, planForResult, {}, []));
            setLoaded(true);
          });
        }
        setLoaded(true);
        return undefined;
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storage, sessionId, reloadKey]);

  // § focus: when the open exercise's last set is done, collapse it and open
  // the next unfinished one. Snapshot of the timer position right after.
  useEffect(() => {
    if (!loaded || session == null || expandedIndex == null) return;
    const id = session.exercises[expandedIndex]?.id;
    if (id == null) return;
    const done = exerciseIsDone(
      session,
      plan,
      extras,
      myorepDoneSetDefIds,
      expandedIndex,
    );
    const wasDone = previousDone.current[id];
    previousDone.current = { ...previousDone.current, [id]: done };
    if (wasDone === false && done) {
      setExpandedIndex(
        nextOpenExercise(
          session,
          plan,
          extras,
          myorepDoneSetDefIds,
          expandedIndex,
        ),
      );
    }
  }, [loaded, session, plan, extras, expandedIndex, myorepDoneSetDefIds]);

  if (!loaded) {
    return <p className="text-sm text-ink-2">Loading…</p>;
  }

  if (loadError) {
    return (
      <LoadError
        message="Couldn't load this workout."
        onRetry={() => {
          setLoadError(false);
          setLoaded(false);
          setReloadKey((key) => key + 1);
        }}
      />
    );
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
      isBodyweight: setDef.weightMode === 'bodyweight',
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
    setRestRunningSince(nowMs());
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
    setRestRunningSince(nowMs());
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
        isBodyweight: extra.weightMode === 'bodyweight',
      }),
    );
    setExtras({
      ...extras,
      [exerciseIndex]: extras[exerciseIndex]?.filter((e) => e.id !== extra.id),
    });
  }

  function handleToggleExercise(index: number) {
    setExpandedIndex((open) => (open === index ? null : index));
  }

  function handleMarkMyorepDone(set: SetDefinition) {
    setMyorepDoneSetDefIds((ids) =>
      ids.includes(set.id) ? ids : [...ids, set.id],
    );
  }

  function handleRestTap() {
    setRestRunningSince(nowMs());
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

  const targetRest = nextTargetRest(current.exercises, plan, skippedFor);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center self-start text-sm text-ink-2 transition-colors duration-100 hover:text-ink"
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

      {expandedIndex == null && (
        <RestTimer
          runningSince={restRunningSince}
          onTap={handleRestTap}
          targetRestSeconds={targetRest}
        />
      )}

      <ol className="flex flex-col gap-3">
        {current.exercises.map((exercise, exerciseIndex) => {
          const expanded = exerciseIndex === expandedIndex;
          const sets = plannedSets.get(exerciseIndex) ?? [];
          const exerciseExtras = extras[exerciseIndex] ?? [];
          const done = exerciseIsDone(
            current,
            plan,
            extras,
            myorepDoneSetDefIds,
            exerciseIndex,
          );
          return (
            <li key={exercise.id} className="flex flex-col gap-3">
              {expanded && (
                <RestTimer
                  runningSince={restRunningSince}
                  onTap={handleRestTap}
                  targetRestSeconds={targetRest}
                />
              )}
              <div className="rounded-lg border border-line bg-panel p-3">
                <button
                  type="button"
                  onClick={() => handleToggleExercise(exerciseIndex)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${exercise.name}`}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <h2 className="font-semibold">{exercise.name}</h2>
                  <span className="flex items-center gap-2">
                    {done && (
                      <span className="text-sm font-medium text-accent-hi">
                        ✓ Done
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className="text-lg leading-none text-ink-3"
                    >
                      {expanded ? '▾' : '▸'}
                    </span>
                  </span>
                </button>

                {expanded && (
                  <>
                    {sets.length === 0 ? (
                      <p className="mt-1 text-sm text-ink-3">
                        No sets planned.
                      </p>
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
                                sourceLoggedWeight={sourceWeightFor(
                                  exercise,
                                  set,
                                )}
                                logged={findLoggedSet(exercise, set)}
                                suggestion={suggestionFor(
                                  exercise,
                                  set,
                                  current.routineId,
                                  history,
                                  settings.roundingIncrement,
                                )}
                                onLog={(input) =>
                                  handleLog(exerciseIndex, set, input)
                                }
                                onAddMiniSet={(miniReps) =>
                                  handleAddMiniSet(exerciseIndex, set, miniReps)
                                }
                                onMarkDone={() => handleMarkMyorepDone(set)}
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
                  </>
                )}
              </div>
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
 * § focus: an exercise is done when every planned set is logged or skipped
 * (myorep sets additionally need "Mark myorep done") and no unlogged extra
 * rows are still open for it. Exercises with no planned sets count as done.
 */
function exerciseIsDone(
  session: WorkoutSession,
  plan: PlanExercise[],
  extras: Record<number, SetDefinition[]>,
  myorepDoneSetDefIds: string[],
  index: number,
): boolean {
  const unit = session.exercises[index];
  const sets = plan[index]?.sets ?? [];
  const plannedDone =
    sets.length === 0 ||
    sets.every((set) => {
      if ((unit.skippedSetDefIds ?? []).includes(set.id)) return true;
      const logged = unit.sets.find((s) => s.setDefId === set.id);
      if (logged == null) return false;
      if (set.isMyorep) return myorepDoneSetDefIds.includes(set.id);
      return true;
    });
  return plannedDone && (extras[index]?.length ?? 0) === 0;
}

/** First exercise (from the top) that still has work remaining. */
function firstOpenExercise(
  session: WorkoutSession,
  plan: PlanExercise[],
  extras: Record<number, SetDefinition[]>,
  myorepDoneSetDefIds: string[],
): number | null {
  for (let i = 0; i < session.exercises.length; i += 1) {
    if (!exerciseIsDone(session, plan, extras, myorepDoneSetDefIds, i)) {
      return i;
    }
  }
  return null;
}

/** Next exercise after `from` that still has work remaining. */
function nextOpenExercise(
  session: WorkoutSession,
  plan: PlanExercise[],
  extras: Record<number, SetDefinition[]>,
  myorepDoneSetDefIds: string[],
  from: number,
): number | null {
  for (let i = from + 1; i < session.exercises.length; i += 1) {
    if (!exerciseIsDone(session, plan, extras, myorepDoneSetDefIds, i)) {
      return i;
    }
  }
  return null;
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
  roundingIncrement: number,
) {
  const prior = findPriorLoggedSet(
    history,
    routineId,
    exercise.exerciseId,
    set.order,
  );
  return suggestNext(set, prior, roundingIncrement);
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
