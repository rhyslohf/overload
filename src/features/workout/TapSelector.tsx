import type { Difficulty } from '../../types/models';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Very easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Hard',
  5: 'Max / failure',
};

const VALUES: Difficulty[] = [1, 2, 3, 4, 5];

interface TapSelectorProps {
  value: Difficulty | null;
  onChange: (difficulty: Difficulty) => void;
  disabled?: boolean;
}

/**
 * 1–5 difficulty tap-selector (§4.2): five large taps — the single most-used
 * interaction in the app, so it gets the craft. Each button shows the number
 * (tabular figures, sized like the numbers that lead the screen) with the
 * RIR-meaning (§7) exposed as an accessible name and a one-line caption under
 * the row.
 */
function TapSelector({ value, onChange, disabled }: TapSelectorProps) {
  return (
    <div>
      <div className="flex gap-1.5">
        {VALUES.map((difficulty) => {
          const selected = value === difficulty;
          return (
            <button
              key={difficulty}
              type="button"
              onClick={() => onChange(difficulty)}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`Difficulty ${difficulty} (${DIFFICULTY_LABELS[difficulty]})`}
              className={`min-h-11 flex-1 rounded-lg border font-semibold tabular-nums transition-colors duration-100 disabled:pointer-events-none disabled:opacity-40 ${
                selected
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-panel text-ink hover:bg-raise focus-visible:border-accent active:bg-raise'
              }`}
            >
              {difficulty}
            </button>
          );
        })}
      </div>
      <p className="mt-1 min-h-5 text-center text-xs text-ink-2">
        {value != null ? DIFFICULTY_LABELS[value] : 'How hard was that set?'}
      </p>
    </div>
  );
}

export default TapSelector;
