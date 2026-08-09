import type { SetDefinition } from '../types/models';

/**
 * One-line human summary of a set definition — used by the routine detail
 * view and the live workout plan ("10 × 100 kg", "To failure × 60 kg",
 * "Myorep: …", "40% of Set 1", …).
 */
export function formatSetDefinition(set: SetDefinition): string {
  const weight =
    set.weightMode === 'percentageOfSet'
      ? percentageSummary(set)
      : set.targetWeightKg != null
        ? `${set.targetWeightKg} kg`
        : '—';
  if (set.isMyorep) {
    const activation = set.toFailure
      ? 'to failure'
      : `${set.myorep?.activationRepTarget ?? '?'} reps`;
    const miniReps = set.myorep?.miniSetRepTarget ?? '?';
    const miniRest = set.myorep?.miniSetRestSeconds ?? '?';
    return `Myorep: ${activation} + minisets of ${miniReps} (${miniRest}s rest) × ${weight}`;
  }
  if (set.toFailure) return `To failure × ${weight}`;
  const reps = set.targetRepsMax
    ? `${set.targetReps}–${set.targetRepsMax}`
    : `${set.targetReps}`;
  return `${reps} × ${weight}`;
}

function percentageSummary(set: SetDefinition): string {
  const percent = set.percentageOf?.percent;
  return percent != null ? `${percent}% of a prior set` : '—';
}
