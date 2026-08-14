import { useSettings } from '../../components/SettingsProvider';

/** §11.4: the increments a lifter might actually load — plates & dumbbells. */
const INCREMENT_OPTIONS = [1, 2.5, 5, 10] as const;

const INCREMENT_LABEL: Record<(typeof INCREMENT_OPTIONS)[number], string> = {
  1: '1 kg',
  2.5: '2.5 kg',
  5: '5 kg',
  10: '10 kg',
};

/**
 * Settings view (§11.4): the rounding increment used for suggested and
 * percentage weights, so they land on real plates/dumbbells instead of
 * arbitrary decimals.
 */
function SettingsView() {
  const { settings, setRoundingIncrement } = useSettings();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
        <h2 className="text-sm font-semibold text-ink-2">Rounding increment</h2>
        <p className="text-sm text-ink-3">
          Suggested and percentage weights snap to this step, matching the
          plates and dumbbells you actually load.
        </p>
        <div className="flex flex-wrap gap-2">
          {INCREMENT_OPTIONS.map((value) => {
            const selected = settings.roundingIncrement === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setRoundingIncrement(value)}
                className={`min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors duration-100 ${
                  selected
                    ? 'border-accent/50 bg-accent/10 text-accent-hi'
                    : 'border-line/70 bg-raise text-ink-2'
                }`}
              >
                {INCREMENT_LABEL[value]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
