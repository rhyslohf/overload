import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorageAdapter } from '../services/localStorageAdapter';
import type { StorageService } from '../services/storage';
import {
  createRoutine,
  createRoutineExercise,
  createSetDefinition,
} from '../types/factories';
import type { WorkoutSession } from '../types/models';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  const store: Storage = {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
  return store;
}

let storage: Storage;
let service: StorageService;

beforeEach(() => {
  storage = memoryStorage();
  service = createLocalStorageAdapter(storage);
});

describe('LocalStorageAdapter — routines', () => {
  it('lists an empty collection by default', async () => {
    await expect(service.listRoutines()).resolves.toEqual([]);
  });

  it('round-trips an upsert -> list -> get', async () => {
    const routine = createRoutine({ name: 'Push Day' });
    routine.exercises = [
      createRoutineExercise({
        name: 'Bench Press',
        order: 0,
        sets: [createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 })],
      }),
    ];

    await service.upsertRoutine(routine);

    const listed = await service.listRoutines();
    expect(listed).toEqual([routine]);

    await expect(service.getRoutine(routine.id)).resolves.toEqual(routine);
  });

  it('upsert replaces an existing routine with the same id', async () => {
    const a = createRoutine({ name: 'A' });
    const b = createRoutine({ name: 'B' });
    const updated = { ...a, name: 'A 2.0' };
    await service.upsertRoutine(a);
    await service.upsertRoutine(b);
    await service.upsertRoutine(updated);

    const listed = await service.listRoutines();
    expect(listed).toHaveLength(2);
    expect(listed.find((r) => r.id === a.id)?.name).toBe('A 2.0');
  });

  it('deletes a routine by id', async () => {
    const routine = createRoutine({ name: 'Doomed' });
    await service.upsertRoutine(routine);
    await service.deleteRoutine(routine.id);

    await expect(service.listRoutines()).resolves.toEqual([]);
    await expect(service.getRoutine(routine.id)).resolves.toBeNull();
  });
});

describe('LocalStorageAdapter — sessions', () => {
  it('round-trips sessions', async () => {
    const session: WorkoutSession = {
      id: 's-1',
      schemaVersion: 1,
      routineId: 'r-1',
      routineName: 'Push Day',
      startedAt: '2026-08-09T00:00:00.000Z',
      status: 'inProgress',
      exercises: [],
    };

    await service.upsertSession(session);
    await expect(service.listSessions()).resolves.toEqual([session]);
    await expect(service.getSession('s-1')).resolves.toEqual(session);
    await expect(service.getSession('missing')).resolves.toBeNull();
  });

  it('deletes a session by id', async () => {
    const doomed: WorkoutSession = {
      id: 's-1',
      schemaVersion: 1,
      routineId: 'r-1',
      routineName: 'Push Day',
      startedAt: '2026-08-09T00:00:00.000Z',
      status: 'inProgress',
      exercises: [],
    };
    const keep: WorkoutSession = {
      ...doomed,
      id: 's-keep',
    };
    await service.upsertSession(doomed);
    await service.upsertSession(keep);
    await service.deleteSession('s-1');

    await expect(service.listSessions()).resolves.toEqual([keep]);
    await expect(service.getSession('s-1')).resolves.toBeNull();
  });
});

describe('LocalStorageAdapter — exercise library', () => {
  it('derives distinct exercises from stored routines', async () => {
    const routine = createRoutine({ name: 'Day' });
    routine.exercises = [
      createRoutineExercise({ name: 'Deadlift', order: 0 }),
      createRoutineExercise({ name: 'Bench Press', order: 1 }),
      createRoutineExercise({ name: 'deadlift', order: 2 }),
    ];
    await service.upsertRoutine(routine);

    const library = await service.getExerciseLibrary();
    expect(library.map((e) => e.name)).toEqual(['Bench Press', 'Deadlift']);
  });

  it('survives independently of read-modify-write order', async () => {
    await service.upsertRoutine(createRoutine({ name: 'A' }));
    await expect(service.getExerciseLibrary()).resolves.toEqual([]);
  });
});

describe('LocalStorageAdapter — settings', () => {
  it('defaults the rounding increment to 2.5 kg (§11.4)', async () => {
    await expect(service.getSettings()).resolves.toEqual({
      roundingIncrement: 2.5,
    });
  });

  it('saves and reloads a custom rounding increment', async () => {
    await service.saveSettings({ roundingIncrement: 5 });

    await expect(service.getSettings()).resolves.toEqual({
      roundingIncrement: 5,
    });
  });

  it('falls back to the default on a corrupt settings payload', async () => {
    storage.setItem('wt:settings', '{not json');

    await expect(service.getSettings()).resolves.toEqual({
      roundingIncrement: 2.5,
    });
  });
});

describe('LocalStorageAdapter — resilience', () => {
  it('treats corrupt payloads as empty', async () => {
    storage.setItem('wt:routines', '{not json');
    await expect(service.listRoutines()).resolves.toEqual([]);
    await expect(service.getExerciseLibrary()).resolves.toEqual([]);
  });

  it('treats a non-collection payload as empty', async () => {
    storage.setItem('wt:routines', JSON.stringify({ nope: true }));
    await expect(service.listRoutines()).resolves.toEqual([]);
  });
});
