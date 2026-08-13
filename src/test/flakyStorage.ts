import type { Routine, WorkoutSession } from '../types/models';
import type { StorageService } from '../services/storage';

/**
 * Wraps a working StorageService but makes `listRoutines` / `listSessions`
 * reject until `enable` is called — lets tests exercise the load-error +
 * Retry path.
 */
export function createFlakyStorage(
  base: StorageService,
): StorageService & { enable(): void } {
  let broken = true;
  const service: StorageService = {
    async listRoutines() {
      if (broken) throw new Error('storage unavailable');
      return base.listRoutines();
    },
    async listSessions() {
      if (broken) throw new Error('storage unavailable');
      return base.listSessions();
    },
    getRoutine: (id) => base.getRoutine(id),
    upsertRoutine: (routine: Routine) => base.upsertRoutine(routine),
    deleteRoutine: (id) => base.deleteRoutine(id),
    getSession: (id) => base.getSession(id),
    upsertSession: (session: WorkoutSession) => base.upsertSession(session),
    deleteSession: (id) => base.deleteSession(id),
    getExerciseLibrary: () => base.getExerciseLibrary(),
  };
  return Object.assign(service, {
    enable() {
      broken = false;
    },
  });
}
