import { exerciseIdForName } from '../utils/exercise';
import { newId } from '../utils/id';
import type {
  LoggedExercise,
  LoggedSet,
  Routine,
  RoutineExercise,
  SetDefinition,
  WorkoutSession,
} from './models';

export function createRoutine(input: {
  name: string;
  description?: string;
}): Routine {
  const now = new Date().toISOString();
  return {
    id: newId(),
    schemaVersion: 1,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    exercises: [],
  };
}

export function createRoutineExercise(input: {
  name: string;
  order: number;
  sets?: SetDefinition[];
}): RoutineExercise {
  return {
    id: newId(),
    exerciseId: exerciseIdForName(input.name),
    name: input.name.trim(),
    order: input.order,
    sets: input.sets ?? [],
  };
}

export function createSetDefinition(
  order: number,
  partial?: Partial<SetDefinition>,
): SetDefinition {
  return {
    id: newId(),
    order,
    weightMode: 'absolute',
    toFailure: false,
    isMyorep: false,
    ...partial,
  };
}

/**
 * §4.2: starting a session snapshots the routine's exercises (names, ids,
 * order) into a fresh WorkoutSession with status `inProgress`. Set results
 * are logged in as they happen (Value objects), so `sets` starts empty.
 */
export function createWorkoutSession(routine: Routine): WorkoutSession {
  const startedAt = new Date().toISOString();
  return {
    id: newId(),
    schemaVersion: 1,
    routineId: routine.id,
    routineName: routine.name,
    startedAt,
    status: 'inProgress',
    exercises: routine.exercises.map((exercise): LoggedExercise => ({
      id: newId(),
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      order: exercise.order,
      sets: [],
    })),
  };
}

/** A logged result for one planned set (or an added set). */
export function createLoggedSet(
  input: {
    setDefId: string;
    order: number;
    weightKg: number;
    reps: number;
    difficulty: LoggedSet['difficulty'];
    myorepMiniSets?: { reps: number }[];
  },
  completedAt: string = new Date().toISOString(),
): LoggedSet {
  return {
    id: newId(),
    setDefId: input.setDefId,
    order: input.order,
    weightKg: input.weightKg,
    reps: input.reps,
    difficulty: input.difficulty,
    myorepMiniSets: input.myorepMiniSets,
    completedAt,
  };
}
