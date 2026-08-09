import type { ExerciseEntry, Routine } from '../types/models';

/**
 * Exercise identity — REQUIREMENTS.md §11 (stable exerciseId) + §4.1
 * autocomplete.
 *
 * An exercise's identity is *derived deterministically from its normalized
 * name*, so the same name typed in two routines resolves to the same
 * `exerciseId`. That's what makes progression matching (§7) and
 * autocomplete-consistency work without storing a bespoke lookup table.
 */

/** Trim, collapse internal whitespace, lowercase. */
export function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** FNV-1a 32-bit hash of the normalized name → stable, collision-resistant. */
export function exerciseIdForName(name: string): string {
  const normalized = normalizeExerciseName(name);
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `ex-${(hash >>> 0).toString(36)}`;
}

/** Local "exercise library" (§4.1) — every distinct exercise ever used. */
export function buildExerciseLibrary(
  routines: readonly Routine[],
): ExerciseEntry[] {
  const seen = new Map<string, ExerciseEntry>();
  for (const routine of routines) {
    for (const exercise of routine.exercises) {
      const key = normalizeExerciseName(exercise.name);
      if (!seen.has(key)) {
        seen.set(key, {
          id: exerciseIdForName(exercise.name),
          name: exercise.name.trim(),
        });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
