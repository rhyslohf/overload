import { useState } from 'react';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import type { Difficulty, LoggedSet, SetDefinition } from '../../types/models';
import type { OverloadSuggestion } from '../overload/suggest';
import { formatLoggedSet } from '../../utils/formatSet';
import { roundToIncrement } from '../../utils/weight';
import TapSelector from './TapSelector';

interface SetLogRowProps {
  set: SetDefinition;
  labelPrefix: string;
  sourceLoggedWeight?: number;
  logged?: LoggedSet;
  // §4.6: progressive-overload suggestion used as the prefill + rationale.
  suggestion?: OverloadSuggestion;
  onLog: (input: {
    weightKg: number;
    reps: number;
    difficulty: Difficulty;
  }) => void;
  onAddMiniSet: (reps: number) => void;
  onSkip?: () => void;
}

function parseNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Form for logging one planned set (§4.2): weight, reps, the 1–5 difficulty
 * tap-selector and a Log set button. A logged set is shown read-only so the
 * row doubles as the running workout log.
 *
 * Myorep sets (§4.2): the first Log set tap records the activation set; the
 * row then turns into a repeatable "add mini-set" form — reps only, weight is
 * fixed at the activation weight — until the user marks the set done.
 */
function SetLogRow({
  set,
  labelPrefix,
  sourceLoggedWeight,
  logged,
  suggestion,
  onLog,
  onAddMiniSet,
  onSkip,
}: SetLogRowProps) {
  const percentage = set.weightMode === 'percentageOfSet';
  const bodyweight = set.weightMode === 'bodyweight';
  const computed = percentage ? computedWeight() : undefined;
  const [weight, setWeight] = useState(() => {
    if (computed != null) return String(computed);
    // §4.6: suggested next weight prefills, always editable.
    if (suggestion?.weightKg != null) return String(suggestion.weightKg);
    if (bodyweight) {
      const added = set.bodyweight?.addedWeightKg;
      return added != null ? String(added) : '';
    }
    return set.targetWeightKg != null ? String(set.targetWeightKg) : '';
  });
  // §4.2: to-failure sets prefill a blank reps field (log actual reps achieved).
  const [reps, setReps] = useState(() => {
    if (set.toFailure) return '';
    if (suggestion?.reps != null) return String(suggestion.reps);
    if (set.isMyorep) {
      return set.myorep?.activationRepTarget != null
        ? String(set.myorep.activationRepTarget)
        : '';
    }
    return set.targetReps != null ? String(set.targetReps) : '';
  });
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  // Mini-set form shown once the activation set is logged (myorep only).
  const [miniSetReps, setMiniSetReps] = useState(
    set.myorep?.miniSetRepTarget != null
      ? String(set.myorep.miniSetRepTarget)
      : '',
  );
  const [miniSetsDone, setMiniSetsDone] = useState(false);

  function computedWeight(): number | undefined {
    if (!percentage || sourceLoggedWeight == null || set.percentageOf == null) {
      return undefined;
    }
    return roundToIncrement(
      (sourceLoggedWeight * set.percentageOf.percent) / 100,
    );
  }

  const miniSets = logged?.myorepMiniSets ?? [];

  if (logged && !(set.isMyorep && !miniSetsDone)) {
    return (
      <div className="rounded-lg border border-line/70 bg-raise p-3">
        <p className="text-sm font-medium tabular-nums text-ink">
          Logged · {formatLoggedSet(logged)}
        </p>
      </div>
    );
  }

  // Myorep: activation set logged → show results + mini-set adder.
  if (logged && set.isMyorep) {
    const miniSetValue = parseNumber(miniSetReps);
    const canAdd = miniSetValue != null && miniSetValue > 0;
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3">
        <p className="text-sm font-medium tabular-nums text-ink">
          Activation · {formatLoggedSet(logged)}
        </p>
        {miniSets.length > 0 && (
          <ol className="flex flex-col gap-1 text-sm text-ink-2">
            {miniSets.map((mini, i) => (
              <li key={i}>
                Mini-set {i + 1} · {mini.reps} reps
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-end gap-2">
          <TextField
            label={`${labelPrefix} Mini-set reps`}
            type="number"
            min={1}
            step={1}
            value={miniSetReps}
            onChange={setMiniSetReps}
            placeholder={
              set.myorep?.miniSetRepTarget != null
                ? String(set.myorep.miniSetRepTarget)
                : '3'
            }
          />
          <Button
            disabled={!canAdd}
            onClick={() => {
              if (miniSetValue == null) return;
              onAddMiniSet(miniSetValue);
              setMiniSetReps(
                set.myorep?.miniSetRepTarget != null
                  ? String(set.myorep.miniSetRepTarget)
                  : '',
              );
            }}
          >
            Add mini-set
          </Button>
        </div>
        <Button variant="secondary" onClick={() => setMiniSetsDone(true)}>
          Mark myorep done
        </Button>
      </div>
    );
  }

  const weightValue = parseNumber(weight);
  const repsValue = parseNumber(reps);
  // §11.2: bodyweight — the added-weight field is optional (0 = pure BW).
  const weightOk = percentage
    ? computed != null
    : bodyweight
      ? weightValue == null || weightValue >= 0
      : weightValue != null && weightValue > 0;
  const repsOk = repsValue != null && repsValue > 0;
  const canLog = difficulty != null && weightOk && repsOk;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3">
      <div className="flex gap-2">
        <TextField
          label={`${labelPrefix} ${bodyweight ? 'Added weight (kg)' : 'Weight (kg)'}`}
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

      {suggestion?.rationale != null && (
        <p className="text-sm text-accent">
          Suggested · {suggestion.rationale}
        </p>
      )}

      <TapSelector value={difficulty} onChange={setDifficulty} />
      <Button
        className="w-full"
        disabled={!canLog}
        onClick={() => {
          if (repsValue == null || difficulty == null) return;
          if (!weightOk) return;
          // §11.2: a blank added-weight field logs 0 kg (pure bodyweight).
          onLog({
            weightKg: weightValue ?? 0,
            reps: repsValue,
            difficulty,
          });
        }}
      >
        Log set
      </Button>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex min-h-11 items-center justify-center self-center text-sm text-ink-2 transition-colors duration-100 hover:text-ink"
        >
          Skip this set
        </button>
      )}
    </div>
  );
}

export default SetLogRow;
