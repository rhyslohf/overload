import type {
  LoggedSet,
  SetDefinition,
  WorkoutSession,
} from '../../types/models';
import { roundToIncrement } from '../../utils/weight';

/**
 * Progressive-overload suggestion algorithm (REQUIREMENTS.md §7).
 *
 * Scope: "last time" is the most recent finished session of the same routine
 * for the same exercise + set order — what the lifter did the last time they
 * ran this exact set. A smarter exercise-wide curve is deliberately deferred.
 *
 * Every threshold is a named constant (§7: "not a magic number buried in a
 * component"), so tuning later is a one-line change.
 */

/** Difficulty ≤ this with target reps met → bump the weight (§7). */
export const EASY_DIFFICULTY = 2;
/** Moderate → keep the weight, encourage +1 rep (§7). */
export const MODERATE_DIFFICULTY = 3;
/** Hard → keep the weight (§7). */
export const HARD_DIFFICULTY = 4;
/** Max/failure → keep the weight (or trim, configurable) (§7). */
export const MAX_DIFFICULTY = 5;
/** Weight bump when easy + reps met: +2.5–5% (§7). */
export const WEIGHT_BUMP_PCT = 0.025;
/** Trim on max-effort / missed reps: −0–5%, default −0% (§7). */
export const WEIGHT_TRIM_PCT = 0;

/** A suggested next set for the live-session prefill (§4.6). */
export interface OverloadSuggestion {
  /** Suggested prefill weight (kg). */
  weightKg?: number;
  /** Suggested prefill reps (e.g. target + 1 on moderate difficulty). */
  reps?: number;
  /** One-line rationale; undefined when there's no prior history. */
  rationale?: string;
}

/**
 * Find the most recent logged set for (routineId, exerciseId, set order)
 * across finished sessions, newest session first (§7 scope).
 */
export function findPriorLoggedSet(
  sessions: readonly WorkoutSession[],
  routineId: string,
  exerciseId: string,
  setOrder: number,
): LoggedSet | undefined {
  const finished = sessions
    .filter((s) => s.routineId === routineId && s.status !== 'inProgress')
    .sort((a, b) =>
      (b.completedAt ?? b.startedAt).localeCompare(
        a.completedAt ?? a.startedAt,
      ),
    );
  for (const session of finished) {
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exercise == null) continue;
    const logged = exercise.sets.find((s) => s.order === setOrder);
    if (logged != null) return logged;
  }
  return undefined;
}

/**
 * v1 heuristic (§7). Returns undefined when no suggestion applies:
 *   - percentage-of-set sets get no independent suggestion (recomputed live);
 *   - no prior history → fall back to the routine's stored target (§4.6).
 */
export function suggestNext(
  setDef: SetDefinition,
  prior: LoggedSet | undefined,
): OverloadSuggestion | undefined {
  if (setDef.weightMode === 'percentageOfSet') return undefined;
  if (prior == null) return undefined;

  const targetReps = targetRepsFor(setDef);
  // No target (to-failure / unset) → reps are best-effort, never a miss.
  const metReps = targetReps == null || prior.reps >= targetReps;
  const bumped = roundToIncrement(prior.weightKg * (1 + WEIGHT_BUMP_PCT));
  const trimmed = roundToIncrement(prior.weightKg * (1 - WEIGHT_TRIM_PCT));
  const priorLine = `Last time: ${prior.weightKg} kg × ${prior.reps} @ difficulty ${prior.difficulty}`;

  if (prior.difficulty <= EASY_DIFFICULTY && metReps) {
    return {
      weightKg: bumped,
      reps: targetReps,
      rationale: `${priorLine} → suggested ${bumped} kg`,
    };
  }
  if (prior.difficulty === MODERATE_DIFFICULTY) {
    const reps = targetReps == null ? undefined : targetReps + 1;
    const hint =
      reps == null
        ? `keep ${prior.weightKg} kg`
        : `keep ${prior.weightKg} kg, try ${reps} reps`;
    return {
      weightKg: prior.weightKg,
      reps,
      rationale: `${priorLine} → ${hint}`,
    };
  }
  if (prior.difficulty === HARD_DIFFICULTY) {
    return {
      weightKg: prior.weightKg,
      reps: targetReps,
      rationale: `${priorLine} → keep ${prior.weightKg} kg`,
    };
  }
  // Max effort, or reps below target → hold (or trim).
  const rationale =
    trimmed === prior.weightKg
      ? `${priorLine} → keep ${prior.weightKg} kg`
      : `${priorLine} → suggested ${trimmed} kg`;
  return { weightKg: trimmed, reps: targetReps, rationale };
}

/**
 * The reps target to compare against. Myorep sets base the whole suggestion
 * on the activation set only (§7); to-failure sets have no reps target.
 */
function targetRepsFor(setDef: SetDefinition): number | undefined {
  if (setDef.isMyorep) return setDef.myorep?.activationRepTarget;
  if (setDef.toFailure) return undefined;
  return setDef.targetReps;
}
