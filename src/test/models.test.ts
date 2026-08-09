import { describe, expect, it } from 'vitest';
import {
  createRoutine,
  createRoutineExercise,
  createSetDefinition,
} from '../types/factories';
import {
  buildExerciseLibrary,
  exerciseIdForName,
  normalizeExerciseName,
} from '../utils/exercise';

describe('createRoutine', () => {
  it('builds a valid empty routine with timestamps', () => {
    const routine = createRoutine({
      name: '  Push Day  ',
      description: ' shoulders & chest ',
    });

    expect(routine.id).toBeTruthy();
    expect(routine.schemaVersion).toBe(1);
    expect(routine.name).toBe('Push Day');
    expect(routine.description).toBe('shoulders & chest');
    expect(routine.exercises).toEqual([]);
    expect(new Date(routine.createdAt).getTime()).not.toBeNaN();
    expect(new Date(routine.updatedAt).getTime()).not.toBeNaN();
  });

  it('omits an empty description', () => {
    const routine = createRoutine({ name: 'Legs' });
    expect(routine.description).toBeUndefined();
  });
});

describe('createRoutineExercise', () => {
  it('derives a stable exercise id from the name', () => {
    const a = createRoutineExercise({ name: 'Barbell Squat', order: 0 });
    const b = createRoutineExercise({ name: '  barbell   squat ', order: 1 });

    expect(a.exerciseId).toBe(b.exerciseId);
    expect(a.exerciseId).toMatch(/^ex-[a-z0-9]+$/);
  });

  it('snapshots the trimmed name and keeps given sets', () => {
    const set = createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 });
    const exercise = createRoutineExercise({
      name: '  Bench Press  ',
      order: 0,
      sets: [set],
    });

    expect(exercise.name).toBe('Bench Press');
    expect(exercise.order).toBe(0);
    expect(exercise.sets).toEqual([set]);
  });
});

describe('createSetDefinition', () => {
  it('defaults to a plain absolute-weight set', () => {
    const set = createSetDefinition(2, { targetReps: 8, targetWeightKg: 100 });

    expect(set.id).toBeTruthy();
    expect(set.order).toBe(2);
    expect(set.weightMode).toBe('absolute');
    expect(set.toFailure).toBe(false);
    expect(set.isMyorep).toBe(false);
    expect(set.targetReps).toBe(8);
    expect(set.targetWeightKg).toBe(100);
  });
});

describe('exercise identity', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeExerciseName('  BARbell   Squat ')).toBe('barbell squat');
  });

  it('is deterministic and distinct for different names', () => {
    expect(exerciseIdForName('Bench Press')).toBe(
      exerciseIdForName('bench press'),
    );
    expect(exerciseIdForName('Squat')).not.toBe(
      exerciseIdForName('Bench Press'),
    );
  });
});

describe('buildExerciseLibrary', () => {
  it('dedupes by normalized name and sorts alphabetically', () => {
    const routine = createRoutine({ name: 'Day' });
    routine.exercises = [
      createRoutineExercise({ name: 'Bench Press', order: 0 }),
      createRoutineExercise({ name: 'Deadlift', order: 1 }),
      createRoutineExercise({ name: 'bench press', order: 2 }),
    ];

    const library = buildExerciseLibrary([routine]);

    expect(library).toHaveLength(2);
    expect(library.map((e) => e.name)).toEqual(['Bench Press', 'Deadlift']);
  });

  it('returns an empty library for no routines', () => {
    expect(buildExerciseLibrary([])).toEqual([]);
  });
});
