import { describe, it, expect } from 'vitest';
import type { LoggedSet, WorkoutSession } from '../../types/models';
import { createLoggedSet, createSetDefinition } from '../../types/factories';
import {
  findPriorLoggedSet,
  suggestNext,
  EASY_DIFFICULTY,
  MODERATE_DIFFICULTY,
  HARD_DIFFICULTY,
  WEIGHT_BUMP_PCT,
} from './suggest';

describe('findPriorLoggedSet', () => {
  function session(
    routineId: string,
    status: WorkoutSession['status'],
    completedAt: string,
    logs: { exerciseId: string; order: number; weightKg: number }[],
  ): WorkoutSession {
    return {
      id: `s-${completedAt}`,
      schemaVersion: 1,
      routineId,
      routineName: 'Push Day',
      startedAt: completedAt,
      completedAt,
      status,
      exercises: logs.map((log) => ({
        id: `ex-${log.exerciseId}`,
        exerciseId: log.exerciseId,
        name: 'Bench Press',
        order: 0,
        sets: [
          createLoggedSet({
            setDefId: `def-${log.exerciseId}-${log.order}`,
            order: log.order,
            weightKg: log.weightKg,
            reps: 8,
            difficulty: 3,
          }),
        ],
      })),
    };
  }

  it('returns the most recent finished session\u2019s matching set', () => {
    const sessions = [
      session('r1', 'completed', '2026-08-01', [
        { exerciseId: 'bench', order: 0, weightKg: 100 },
      ]),
      session('r1', 'completed', '2026-08-05', [
        { exerciseId: 'bench', order: 0, weightKg: 105 },
      ]),
    ];

    const prior = findPriorLoggedSet(sessions, 'r1', 'bench', 0);

    expect(prior?.weightKg).toBe(105);
  });

  it('ignores in-progress sessions', () => {
    const sessions = [
      session('r1', 'inProgress', '2026-08-10', [
        { exerciseId: 'bench', order: 0, weightKg: 200 },
      ]),
      session('r1', 'completed', '2026-08-01', [
        { exerciseId: 'bench', order: 0, weightKg: 100 },
      ]),
    ];

    const prior = findPriorLoggedSet(sessions, 'r1', 'bench', 0);

    expect(prior?.weightKg).toBe(100);
  });

  it('ignores other routines, exercises and set orders', () => {
    const sessions = [
      session('r1', 'completed', '2026-08-01', [
        { exerciseId: 'bench', order: 1, weightKg: 90 },
      ]),
      session('r2', 'completed', '2026-08-01', [
        { exerciseId: 'bench', order: 0, weightKg: 120 },
      ]),
    ];

    expect(findPriorLoggedSet(sessions, 'r1', 'bench', 0)).toBeUndefined();
    expect(findPriorLoggedSet(sessions, 'r1', 'press', 1)).toBeUndefined();
  });

  it('returns undefined with no finished sessions', () => {
    expect(findPriorLoggedSet([], 'r1', 'bench', 0)).toBeUndefined();
  });
});

describe('suggestNext', () => {
  function prior(input: Partial<LoggedSet> & { reps: number }): LoggedSet {
    return createLoggedSet({
      setDefId: 'def-1',
      order: 0,
      weightKg: 100,
      reps: input.reps,
      difficulty: input.difficulty ?? 3,
    });
  }

  it('gives no independent suggestion for percentage-of-set sets', () => {
    const set = createSetDefinition(0, {
      weightMode: 'percentageOfSet',
      percentageOf: { sourceSetId: 'def-0', percent: 80 },
    });

    expect(suggestNext(set, prior({ reps: 8, difficulty: 2 }))).toBeUndefined();
  });

  it('gives no suggestion for warm-up sets even with easy history', () => {
    const set = createSetDefinition(0, {
      isWarmup: true,
      targetReps: 8,
      targetWeightKg: 100,
    });

    expect(
      suggestNext(set, prior({ reps: 10, difficulty: 1 })),
    ).toBeUndefined();
  });

  it('progresses pure bodyweight sets by reps, not weight', () => {
    const set = createSetDefinition(0, {
      weightMode: 'bodyweight',
      bodyweight: { addedWeightKg: 0 },
      targetReps: 10,
    });
    const bw = createLoggedSet({
      setDefId: 'def-1',
      order: 0,
      weightKg: 0,
      reps: 12,
      difficulty: 2,
      isBodyweight: true,
    });

    const result = suggestNext(set, bw);

    expect(result?.weightKg).toBe(0);
    expect(result?.reps).toBe(11);
    expect(result?.rationale).toMatch(/try 11 reps/);
  });

  it('keeps the target reps for a bodyweight set that was hard', () => {
    const set = createSetDefinition(0, {
      weightMode: 'bodyweight',
      bodyweight: { addedWeightKg: 5 },
      targetReps: 8,
    });
    const bw = createLoggedSet({
      setDefId: 'def-1',
      order: 0,
      weightKg: 5,
      reps: 8,
      difficulty: 4,
      isBodyweight: true,
    });

    const result = suggestNext(set, bw);

    expect(result?.reps).toBe(8);
  });

  it('returns undefined with no prior log (routine default used)', () => {
    const set = createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 });
    expect(suggestNext(set, undefined)).toBeUndefined();
  });

  it('bumps weight ~+2.5% to a plate increment when easy and reps met', () => {
    const set = createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 });
    const priorLog = prior({ reps: 10, difficulty: 2 });

    const result = suggestNext(set, priorLog);

    const expected = Math.round((100 * (1 + WEIGHT_BUMP_PCT)) / 2.5) * 2.5;
    expect(result?.weightKg).toBe(expected);
    expect(result?.reps).toBe(8);
    expect(result?.rationale).toMatch(/→ suggested \d+(\.\d+)? kg/);
  });

  it('treats to-failure sets as best-effort reps (never a rep miss)', () => {
    const set = createSetDefinition(0, {
      toFailure: true,
      targetWeightKg: 100,
    });
    const result = suggestNext(set, prior({ reps: 6, difficulty: 1 }));

    expect(result?.weightKg).toBeGreaterThan(100);
  });

  it('keeps the weight and encourages +1 rep on moderate difficulty', () => {
    const set = createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 });
    const result = suggestNext(
      set,
      prior({ reps: 8, difficulty: MODERATE_DIFFICULTY }),
    );

    expect(result?.weightKg).toBe(100);
    expect(result?.reps).toBe(9);
    expect(result?.rationale).toMatch(/try 9 reps/);
  });

  it('keeps the weight on hard difficulty', () => {
    const set = createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 });
    const result = suggestNext(
      set,
      prior({ reps: 8, difficulty: HARD_DIFFICULTY }),
    );

    expect(result?.weightKg).toBe(100);
    expect(result?.rationale).toMatch(/keep 100 kg/);
  });

  it('keeps the weight on max effort (difficulty 5)', () => {
    const set = createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 });
    const result = suggestNext(set, prior({ reps: 8, difficulty: 5 }));

    expect(result?.weightKg).toBe(100);
  });

  it('keeps the weight when reps fall below target', () => {
    const set = createSetDefinition(0, { targetReps: 10, targetWeightKg: 100 });
    const result = suggestNext(set, prior({ reps: 8, difficulty: 2 }));

    expect(result?.weightKg).toBe(100);
  });

  it('bases myorep suggestions on the activation set only', () => {
    const set = createSetDefinition(0, {
      isMyorep: true,
      myorep: { activationRepTarget: 12 },
      targetWeightKg: 100,
    });
    const activation = createLoggedSet({
      setDefId: 'def-1',
      order: 0,
      weightKg: 100,
      reps: 14,
      difficulty: 2,
      myorepMiniSets: [{ reps: 3 }],
    });

    const result = suggestNext(set, activation);

    expect(result?.weightKg).toBeGreaterThan(100);
    expect(result?.reps).toBe(12);
  });

  it('does not suggest +1 rep when the set has no reps target', () => {
    const set = createSetDefinition(0, {
      toFailure: true,
      targetWeightKg: 100,
    });
    const result = suggestNext(
      set,
      prior({ reps: 8, difficulty: MODERATE_DIFFICULTY }),
    );

    expect(result?.reps).toBeUndefined();
  });

  it('uses the routine\u2019s stored target when there is no history (EASY const sanity)', () => {
    expect(EASY_DIFFICULTY).toBe(2);
  });
});
