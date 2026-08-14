import type { ExerciseEntry, Routine, WorkoutSession } from '../types/models';

/** App preferences persisted serverlessly (§11.4). */
export interface AppSettings {
  /** Rounding increment for suggested/percentage weights — real plates/dumbbells. */
  roundingIncrement: number;
}

/**
 * StorageService interface (REQUIREMENTS.md §4.4).
 *
 * The UI never touches browser storage directly — everything reads and
 * writes through this interface.
 *
 * Methods are async (Promise-based) even though the current adapter is
 * backed by synchronous localStorage: IndexedDB (the fallback if local
 * storage outgrows its ~5–10MB ceiling) is async by nature, so a future
 * IndexedDBAdapter can swap in without touching feature code.
 */
export interface StorageService {
  /* Routines */
  listRoutines(): Promise<Routine[]>;
  getRoutine(id: string): Promise<Routine | null>;
  upsertRoutine(routine: Routine): Promise<void>;
  deleteRoutine(id: string): Promise<void>;

  /* Workout sessions — used from Phase 3 (live logging) onward */
  listSessions(): Promise<WorkoutSession[]>;
  getSession(id: string): Promise<WorkoutSession | null>;
  upsertSession(session: WorkoutSession): Promise<void>;
  deleteSession(id: string): Promise<void>;

  /* App settings (§11.4) */
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;

  /* Exercise library (§4.1) — distinct exercises seen across routines */
  getExerciseLibrary(): Promise<ExerciseEntry[]>;
}
