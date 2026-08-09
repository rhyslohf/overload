import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { createRoutineExercise } from '../../types/factories';
import type { RoutineExercise, SetDefinition } from '../../types/models';
import { moveItem, removeAt, renumber } from '../../utils/order';
import SetList from './SetList';

interface ExerciseListProps {
  exercises: RoutineExercise[];
  onChange: (exercises: RoutineExercise[]) => void;
}

function displayName(exercise: RoutineExercise, index: number): string {
  const name = exercise.name.trim();
  return name || `exercise ${index + 1}`;
}

/**
 * Ordered list of a routine's exercises. Handles the reorder/add/remove
 * operations immutably through the order utils, and reports new exercise
 * sets back up through `onChange`. Blank-named exercises are kept in the
 * list for the editor to fill in, and filtered on save.
 */
function ExerciseList({ exercises, onChange }: ExerciseListProps) {
  function handleRename(index: number, name: string) {
    const next = [...exercises];
    next[index] = { ...next[index], name };
    onChange(next);
  }

  function handleMove(index: number, direction: -1 | 1) {
    onChange(moveItem(exercises, index, direction));
  }

  function handleRemove(index: number) {
    onChange(removeAt(exercises, index));
  }

  function handleExercisePatch(
    index: number,
    partial: Partial<RoutineExercise>,
  ) {
    const next = [...exercises];
    next[index] = { ...next[index], ...partial };
    onChange(next);
  }

  function handleSetsChange(index: number, sets: SetDefinition[]) {
    handleExercisePatch(index, { sets });
  }

  function handleAdd() {
    onChange(
      renumber([
        ...exercises,
        createRoutineExercise({ name: '', order: exercises.length }),
      ]),
    );
  }

  return (
    <section aria-label="Exercises" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Exercises</h2>

      {exercises.length === 0 && (
        <p className="text-sm text-ink-2">
          No exercises yet — add your first one.
        </p>
      )}

      {exercises.map((exercise, index) => {
        const label = displayName(exercise, index);
        return (
          <div
            key={exercise.id}
            className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-2">
                {index + 1}.
              </span>
              <Button
                variant="secondary"
                className="px-2"
                disabled={index === 0}
                aria-label={`Move ${label} up`}
                onClick={() => handleMove(index, -1)}
              >
                ↑
              </Button>
              <Button
                variant="secondary"
                className="px-2"
                disabled={index === exercises.length - 1}
                aria-label={`Move ${label} down`}
                onClick={() => handleMove(index, 1)}
              >
                ↓
              </Button>
              <Button
                variant="danger"
                className="ml-auto px-2"
                aria-label={`Remove ${label}`}
                onClick={() => handleRemove(index)}
              >
                Remove
              </Button>
            </div>
            <TextField
              label={`Exercise ${index + 1}`}
              value={exercise.name}
              onChange={(value) => handleRename(index, value)}
              placeholder="e.g. Bench Press"
              maxLength={60}
            />

            <SetList
              sets={exercise.sets}
              onChange={(sets) => handleSetsChange(index, sets)}
            />
          </div>
        );
      })}

      <Button variant="secondary" className="w-full" onClick={handleAdd}>
        Add exercise
      </Button>
    </section>
  );
}

export default ExerciseList;
