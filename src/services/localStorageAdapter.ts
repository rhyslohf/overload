import type { ExerciseEntry, Routine, WorkoutSession } from '../types/models';
import { SCHEMA_VERSION } from '../types/models';
import { buildExerciseLibrary } from '../utils/exercise';
import type { StorageService } from './storage';

const ROUTINES_KEY = 'wt:routines';
const SESSIONS_KEY = 'wt:sessions';

interface StoredCollection<T> {
  schemaVersion: number;
  items: T[];
}

function readCollection<T>(storage: Storage, key: string): T[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredCollection<T>;
    // Runtime JSON over the untyped storage boundary — an explicit cast is
    // the intended bridge here, so no-unnecessary-type-assertion is disabled
    // for this one line rather than contorting the parse.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return Array.isArray(parsed.items) ? (parsed.items as T[]) : [];
  } catch {
    // Corrupted/malformed payload — treat as empty rather than crashing the
    // app; a future migration layer can reconcile real corruption (§5).
    return [];
  }
}

function writeCollection<T>(storage: Storage, key: string, items: T[]): void {
  const payload: StoredCollection<T> = { schemaVersion: SCHEMA_VERSION, items };
  storage.setItem(key, JSON.stringify(payload));
}

/**
 * localStorage-backed StorageService.
 *
 * Takes an optional `Storage` so tests can supply a scratch store and so the
 * browser global is only ever touched through this adapter.
 */
export function createLocalStorageAdapter(
  storage: Storage = window.localStorage,
): StorageService {
  return {
    async listRoutines(): Promise<Routine[]> {
      return readCollection<Routine>(storage, ROUTINES_KEY);
    },

    async getRoutine(id) {
      const routines = readCollection<Routine>(storage, ROUTINES_KEY);
      return routines.find((routine) => routine.id === id) ?? null;
    },

    async upsertRoutine(routine) {
      const routines = readCollection<Routine>(storage, ROUTINES_KEY);
      const next = routines.some((existing) => existing.id === routine.id)
        ? routines.map((existing) =>
            existing.id === routine.id ? routine : existing,
          )
        : [...routines, routine];
      writeCollection(storage, ROUTINES_KEY, next);
    },

    async deleteRoutine(id) {
      const routines = readCollection<Routine>(storage, ROUTINES_KEY).filter(
        (routine) => routine.id !== id,
      );
      writeCollection(storage, ROUTINES_KEY, routines);
    },

    async listSessions(): Promise<WorkoutSession[]> {
      return readCollection<WorkoutSession>(storage, SESSIONS_KEY);
    },

    async getSession(id) {
      const sessions = readCollection<WorkoutSession>(storage, SESSIONS_KEY);
      return sessions.find((session) => session.id === id) ?? null;
    },

    async upsertSession(session) {
      const sessions = readCollection<WorkoutSession>(storage, SESSIONS_KEY);
      const next = sessions.some((existing) => existing.id === session.id)
        ? sessions.map((existing) =>
            existing.id === session.id ? session : existing,
          )
        : [...sessions, session];
      writeCollection(storage, SESSIONS_KEY, next);
    },

    async getExerciseLibrary(): Promise<ExerciseEntry[]> {
      const routines = readCollection<Routine>(storage, ROUTINES_KEY);
      return buildExerciseLibrary(routines);
    },
  };
}
