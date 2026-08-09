import { useEffect, useId, useRef, useState } from 'react';
import type { ExerciseEntry } from '../../types/models';
import { normalizeExerciseName } from '../../utils/exercise';

interface ExerciseNameFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: ExerciseEntry[];
  placeholder?: string;
}

const MAX_SUGGESTIONS = 6;

/**
 * Exercise-name input with autocomplete from the local exercise library
 * (§4.1). Suggestions match on a normalized substring and jump into the
 * input on click/tap. Matches are recomputed from the live value, so typing
 * freely is still fully supported (custom exercises).
 */
function ExerciseNameField({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
}: ExerciseNameFieldProps) {
  const inputId = useId();
  const listId = `${inputId}-suggestions`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches =
    value.trim().length > 0
      ? suggestions
          .filter((entry) =>
            normalizeExerciseName(entry.name).includes(
              normalizeExerciseName(value),
            ),
          )
          .slice(0, MAX_SUGGESTIONS)
      : [];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current != null &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function choose(entry: ExerciseEntry) {
    onChange(entry.name);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (matches.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter' && highlight >= 0) {
      event.preventDefault();
      choose(matches[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm text-ink-2">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setHighlight(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={60}
        className="min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {open && value.trim().length > 0 && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Exercise suggestions"
          className="absolute top-full z-10 mt-1 flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-lg"
        >
          {matches.map((entry, index) => (
            <li
              key={entry.id}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => choose(entry)}
              onMouseEnter={() => setHighlight(index)}
              data-selected={index === highlight}
              className="cursor-pointer px-3 py-2 text-sm text-ink transition-colors duration-75 hover:bg-raise data-[selected=true]:bg-raise"
            >
              {entry.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ExerciseNameField;
