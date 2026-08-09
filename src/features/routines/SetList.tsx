import Button from '../../components/Button';
import Select from '../../components/Select';
import Switch from '../../components/Switch';
import TextField from '../../components/TextField';
import { createSetDefinition } from '../../types/factories';
import type { SetDefinition } from '../../types/models';
import { moveItem, removeAt, renumber } from '../../utils/order';
import { roundToIncrement } from '../../utils/weight';

interface SetListProps {
  sets: SetDefinition[];
  onChange: (sets: SetDefinition[]) => void;
}

function numberInput(value: number | undefined): string {
  return value == null ? '' : String(value);
}

function parseNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Defaults applied when a Myorep toggle is switched on (§4.1). */
const MYOREP_DEFAULTS = {
  activationRepTarget: 15,
  miniSetRepTarget: 3,
  miniSetRestSeconds: 20,
} as const;

/**
 * Ordered list of an exercise's sets. Phase 2 advanced toggles: to-failure
 * (no target reps), myorep (activation + mini-set config, §4.1) and — from
 * the next item — percentage-of-set. Immutable add/remove/reorder.
 */
function SetList({ sets, onChange }: SetListProps) {
  function handlePatch(index: number, partial: Partial<SetDefinition>) {
    const next = [...sets];
    next[index] = { ...next[index], ...partial };
    onChange(next);
  }

  function handleMove(index: number, direction: -1 | 1) {
    onChange(moveItem(sets, index, direction));
  }

  function handleRemove(index: number) {
    onChange(removeAt(sets, index));
  }

  function handleAdd() {
    onChange(renumber([...sets, createSetDefinition(sets.length)]));
  }

  function handleToFailureToggle(index: number) {
    const set = sets[index];
    handlePatch(index, {
      toFailure: !set.toFailure,
      // §4.1: target reps are omitted when To-Failure is on
      targetReps: set.toFailure ? set.targetReps : undefined,
    });
  }

  function handleMyorepToggle(index: number) {
    const set = sets[index];
    if (set.isMyorep) {
      handlePatch(index, { isMyorep: false, myorep: undefined });
    } else {
      handlePatch(index, {
        isMyorep: true,
        myorep: { ...MYOREP_DEFAULTS },
      });
    }
  }

  function handleMyorepPatch(
    index: number,
    field: keyof NonNullable<SetDefinition['myorep']>,
    value: number | undefined,
  ) {
    handlePatch(index, {
      myorep: { ...sets[index].myorep, [field]: value },
    });
  }

  function handlePercentageToggle(index: number) {
    const set = sets[index];
    if (set.weightMode === 'percentageOfSet') {
      handlePatch(index, {
        weightMode: 'absolute',
        percentageOf: undefined,
      });
    } else {
      // §4.1: defaults to the immediately preceding set in the same exercise
      const source = sets[index - 1];
      handlePatch(index, {
        weightMode: 'percentageOfSet',
        percentageOf: source
          ? { sourceSetId: source.id, percent: 80 }
          : undefined,
      });
    }
  }

  function handlePercentagePatch(
    index: number,
    field: 'sourceSetId' | 'percent',
    value: string | number | undefined,
  ) {
    const current = sets[index].percentageOf;
    handlePatch(index, {
      percentageOf: {
        sourceSetId: current?.sourceSetId ?? '',
        percent: current?.percent ?? 0,
        ...(field === 'sourceSetId' ? { sourceSetId: String(value) } : {}),
        ...(field === 'percent' ? { percent: value as number } : {}),
      },
    });
  }

  /** §4.1: read-only derived weight, rounded to the plate increment. */
  function computedWeight(index: number): number | null {
    const set = sets[index];
    const percentage = set.percentageOf;
    if (!percentage || percentage.percent <= 0) return null;
    const source = sets.find((s) => s.id === percentage.sourceSetId);
    if (!source || source.targetWeightKg == null) return null;
    return roundToIncrement((source.targetWeightKg * percentage.percent) / 100);
  }

  /** §4.1: the reference must point to an earlier set in this exercise. */
  function sourceIsValid(index: number): boolean {
    const ref = sets[index].percentageOf?.sourceSetId;
    if (!ref) return false;
    return sets.slice(0, index).some((s) => s.id === ref);
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink-2">Sets</h3>

      {sets.length === 0 && (
        <p className="text-sm text-ink-3">No sets yet — add your first set.</p>
      )}

      {sets.map((set, index) => (
        <div
          key={set.id}
          className="flex flex-col gap-2 rounded-lg border border-line/70 bg-raise p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-2">
              Set {index + 1}
            </span>
            <Button
              variant="secondary"
              className="px-2"
              disabled={index === 0}
              aria-label={`Move set ${index + 1} up`}
              onClick={() => handleMove(index, -1)}
            >
              ↑
            </Button>
            <Button
              variant="secondary"
              className="px-2"
              disabled={index === sets.length - 1}
              aria-label={`Move set ${index + 1} down`}
              onClick={() => handleMove(index, 1)}
            >
              ↓
            </Button>
            <Button
              variant="danger"
              className="ml-auto px-2"
              aria-label={`Remove set ${index + 1}`}
              onClick={() => handleRemove(index)}
            >
              Remove
            </Button>
          </div>

          <div className="flex gap-2">
            <Switch
              className="flex-1"
              checked={set.toFailure}
              label="To failure"
              ariaLabel={`Set ${index + 1} to failure`}
              onClick={() => handleToFailureToggle(index)}
            />
            <Switch
              className="flex-1"
              checked={set.isMyorep}
              label="Myorep"
              ariaLabel={`Set ${index + 1} Myorep`}
              onClick={() => handleMyorepToggle(index)}
            />
            <Switch
              className="flex-1"
              checked={set.weightMode === 'percentageOfSet'}
              label="% of set"
              ariaLabel={`Set ${index + 1} percent of set`}
              onClick={() => handlePercentageToggle(index)}
            />
          </div>

          <div className="flex gap-2">
            {!set.toFailure && !set.isMyorep && (
              <TextField
                label={`Set ${index + 1} reps`}
                type="number"
                min={1}
                step={1}
                value={numberInput(set.targetReps)}
                onChange={(raw) =>
                  handlePatch(index, { targetReps: parseNumber(raw) })
                }
                placeholder="10"
              />
            )}
            {set.weightMode !== 'percentageOfSet' && (
              <TextField
                label={`Set ${index + 1} weight (kg)`}
                type="number"
                min={0}
                step={0.5}
                value={numberInput(set.targetWeightKg)}
                onChange={(raw) =>
                  handlePatch(index, { targetWeightKg: parseNumber(raw) })
                }
                placeholder={set.isMyorep ? 'Activation weight' : '60'}
              />
            )}
          </div>

          {set.isMyorep && (
            <div className="flex flex-col gap-2 rounded-lg border border-line/70 bg-panel p-3">
              <p className="text-sm font-semibold text-ink-2">Myorep config</p>
              <div className="flex gap-2">
                <TextField
                  label={`Set ${index + 1} activation reps`}
                  type="number"
                  min={1}
                  step={1}
                  value={numberInput(set.myorep?.activationRepTarget)}
                  onChange={(raw) =>
                    handleMyorepPatch(
                      index,
                      'activationRepTarget',
                      parseNumber(raw),
                    )
                  }
                  placeholder="15"
                />
                <TextField
                  label={`Set ${index + 1} mini-set reps`}
                  type="number"
                  min={1}
                  step={1}
                  value={numberInput(set.myorep?.miniSetRepTarget)}
                  onChange={(raw) =>
                    handleMyorepPatch(
                      index,
                      'miniSetRepTarget',
                      parseNumber(raw),
                    )
                  }
                  placeholder="3"
                />
                <TextField
                  label={`Set ${index + 1} mini-set rest (s)`}
                  type="number"
                  min={1}
                  step={1}
                  value={numberInput(set.myorep?.miniSetRestSeconds)}
                  onChange={(raw) =>
                    handleMyorepPatch(
                      index,
                      'miniSetRestSeconds',
                      parseNumber(raw),
                    )
                  }
                  placeholder="20"
                />
              </div>
              <div className="flex gap-2">
                <TextField
                  label={`Set ${index + 1} max mini-sets`}
                  type="number"
                  min={1}
                  step={1}
                  value={numberInput(set.myorep?.maxMiniSets)}
                  onChange={(raw) =>
                    handleMyorepPatch(index, 'maxMiniSets', parseNumber(raw))
                  }
                  placeholder="Optional"
                />
                <TextField
                  label={`Set ${index + 1} stop below reps`}
                  type="number"
                  min={1}
                  step={1}
                  value={numberInput(set.myorep?.stopBelowReps)}
                  onChange={(raw) =>
                    handleMyorepPatch(index, 'stopBelowReps', parseNumber(raw))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          )}

          {set.weightMode === 'percentageOfSet' && (
            <div className="flex flex-col gap-2 rounded-lg border border-line/70 bg-panel p-3">
              <p className="text-sm font-semibold text-ink-2">Percent of set</p>
              {index === 0 || sets.length === 1 ? (
                <p className="text-sm text-ink-3">
                  No earlier set to base this on — reorder a set before it
                  first.
                </p>
              ) : (
                <div className="flex gap-2">
                  <Select
                    label={`Set ${index + 1} based on`}
                    value={set.percentageOf?.sourceSetId ?? ''}
                    onChange={(value) =>
                      handlePercentagePatch(index, 'sourceSetId', value)
                    }
                    options={Array.from({ length: index }, (_, k) => {
                      const s = sets[k];
                      const name =
                        s.targetWeightKg != null
                          ? `Set ${k + 1} (${s.targetWeightKg} kg)`
                          : `Set ${k + 1}`;
                      return { value: s.id, label: name };
                    })}
                  />
                  <TextField
                    label={`Set ${index + 1} percent`}
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    value={numberInput(set.percentageOf?.percent)}
                    onChange={(raw) =>
                      handlePercentagePatch(index, 'percent', parseNumber(raw))
                    }
                    placeholder="80"
                  />
                </div>
              )}
              {(() => {
                const computed = computedWeight(index);
                if (computed != null) {
                  return (
                    <p className="text-sm text-ink-2">Load {computed} kg</p>
                  );
                }
                if (set.percentageOf != null && !sourceIsValid(index)) {
                  return (
                    <p className="text-sm text-danger">
                      The base set is missing or after this set — reorder a set
                      before it first.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      ))}

      <Button variant="secondary" onClick={handleAdd}>
        Add set
      </Button>
    </div>
  );
}

export default SetList;
