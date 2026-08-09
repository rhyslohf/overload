import { exerciseIdForName } from '../utils/exercise';
import { newId } from '../utils/id';
import type { Routine, RoutineExercise, SetDefinition } from './models';

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
