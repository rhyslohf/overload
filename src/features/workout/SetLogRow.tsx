import { useState } from 'react';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import type { Difficulty, LoggedSet, SetDefinition } from '../../types/models';
import { roundToIncrement } from '../../utils/weight';
import TapSelector from './TapSelector';

interface SetLogRowProps {
  set: SetDefinition;
  labelPrefix: string;
  sourceLoggedWeight?: number;
  logged?: LoggedSet;
  onLog: (input: {
    weightKg: number;
    reps: number;
    difficulty: Difficulty;
  }) => void;
}

function parseNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function loggedSummary(logged: LoggedSet): string {
  const sets = logged.myorepMiniSets?.length
    ? ` + ${logged.myorepMiniSets.length} mini-sets`
    : '';
  return `${logged.weightKg} kg × ${logged.reps} · difficulty ${logged.difficulty}${sets}`;
}

/**
 * Form for logging one planned set (§4.2): weight, reps, the 1–5 difficulty
 * tap-selector and a Log set button. A logged set is shown read-only so the
 * row doubles as the running workout log.
 */
function SetLogRow({
  set,
  labelPrefix,
  sourceLoggedWeight,
  logged,
  onLog,
}: SetLogRowProps) {
  const percentage = set.weightMode === 'percentageOfSet';
  const computed = percentage ? computedWeight() : undefined;
  const [weight, setWeight] = useState(
    computed != null
      ? String(computed)
      : set.targetWeightKg != null
        ? String(set.targetWeightKg)
        : '',
  );
  // §4.2: to-failure sets prefill a blank reps field (log actual reps achieved).
  const [reps, setReps] = useState(
    set.toFailure ? '' : set.targetReps != null ? String(set.targetReps) : '',
  );
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  function computedWeight(): number | undefined {
    if (!percentage || sourceLoggedWeight == null || set.percentageOf == null) {
      return undefined;
    }
    return roundToIncrement(
      (sourceLoggedWeight * set.percentageOf.percent) / 100,
    );
  }

  if (logged) {
    return (
      <div className="rounded-lg border border-line/70 bg-raise p-3">
        <p className="text-sm font-medium tabular-nums text-ink">
          Logged · {loggedSummary(logged)}
        </p>
      </div>
    );
  }

  const weightValue = parseNumber(weight);
  const repsValue = parseNumber(reps);
  const weightOk = percentage
    ? computed != null
    : weightValue != null && weightValue > 0;
  const repsOk = repsValue != null && repsValue > 0;
  const canLog = difficulty != null && weightOk && repsOk;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3">
      <div className="flex gap-2">
        <TextField
          label={`${labelPrefix} Weight (kg)`}
          type="number"
          min={0}
          step={0.5}
          value={weight}
          onChange={setWeight}
          placeholder="0"
          disabled={percentage}
        />
        <TextField
          label={`${labelPrefix} Reps`}
          type="number"
          min={1}
          step={1}
          value={reps}
          onChange={setReps}
          placeholder={set.isMyorep ? '15' : '10'}
        />
      </div>

      {percentage && sourceLoggedWeight == null && (
        <p className="text-sm text-ink-3">
          Log its source set first — weight is a percentage of it.
        </p>
      )}
      {percentage && sourceLoggedWeight != null && computed != null && (
        <p className="text-sm text-ink-2">
          Load {computed} kg ({set.percentageOf?.percent}% of{' '}
          {sourceLoggedWeight} kg)
        </p>
      )}

      <TapSelector value={difficulty} onChange={setDifficulty} />
      <Button
        className="w-full"
        disabled={!canLog}
        onClick={() => {
          if (weightValue == null || repsValue == null || difficulty == null) {
            return;
          }
          onLog({ weightKg: weightValue, reps: repsValue, difficulty });
        }}
      >
        Log set
      </Button>
    </div>
  );
}

export default SetLogRow;
