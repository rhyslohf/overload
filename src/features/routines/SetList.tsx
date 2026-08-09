import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { createSetDefinition } from '../../types/factories';
import type { SetDefinition } from '../../types/models';
import { moveItem, removeAt, renumber } from '../../utils/order';

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

/**
 * Ordered list of an exercise's sets. Phase 1 kept sets plain (reps +
 * weight only); Phase 2 adds the advanced toggles (to-failure, myorep,
 * percentage). Immutable add/remove/reorder through the order utils.
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

          <button
            type="button"
            role="switch"
            aria-checked={set.toFailure}
            aria-label={`Set ${index + 1} to failure`}
            onClick={() => handleToFailureToggle(index)}
            className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors duration-100 ${
              set.toFailure
                ? 'border-accent/50 bg-accent/10 text-accent-hi'
                : 'border-line/70 bg-panel text-ink-2'
            }`}
          >
            To failure
            <span
              aria-hidden="true"
              className={`h-5 w-9 rounded-full p-0.5 transition-colors duration-100 ${
                set.toFailure ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-panel transition-transform duration-100 ${
                  set.toFailure ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>

          {!set.toFailure && (
            <div className="flex gap-2">
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
              <TextField
                label={`Set ${index + 1} weight (kg)`}
                type="number"
                min={0}
                step={0.5}
                value={numberInput(set.targetWeightKg)}
                onChange={(raw) =>
                  handlePatch(index, { targetWeightKg: parseNumber(raw) })
                }
                placeholder="60"
              />
            </div>
          )}
          {set.toFailure && (
            <div className="flex gap-2">
              <TextField
                label={`Set ${index + 1} weight (kg)`}
                type="number"
                min={0}
                step={0.5}
                value={numberInput(set.targetWeightKg)}
                onChange={(raw) =>
                  handlePatch(index, { targetWeightKg: parseNumber(raw) })
                }
                placeholder="60"
              />
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
