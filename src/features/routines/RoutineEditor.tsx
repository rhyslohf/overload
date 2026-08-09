import { useState, type FormEvent } from 'react';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { createRoutine } from '../../types/factories';
import type { Routine, RoutineExercise } from '../../types/models';
import { exerciseIdForName } from '../../utils/exercise';
import { renumber } from '../../utils/order';
import ExerciseList from './ExerciseList';

interface RoutineEditorProps {
  initialRoutine?: Routine | null;
  onSave: (routine: Routine) => void;
  onCancel: () => void;
}

/**
 * Create/edit a routine's identity (name + optional description). Exercises
 * and sets are edited in the same screen from the next phase on — this
 * phase keeps the form to the identity fields.
 */
function RoutineEditor({
  initialRoutine,
  onSave,
  onCancel,
}: RoutineEditorProps) {
  const editing = initialRoutine != null;
  const [name, setName] = useState(initialRoutine?.name ?? '');
  const [description, setDescription] = useState(
    initialRoutine?.description ?? '',
  );
  const [exercises, setExercises] = useState<RoutineExercise[]>(
    initialRoutine?.exercises ?? [],
  );

  const nameValid = name.trim().length > 0;
  const exercisesComplete = exercises.every(
    (exercise) =>
      exercise.name.trim() !== '' &&
      exercise.sets.every(
        (set) =>
          set.targetReps != null &&
          set.targetReps > 0 &&
          set.targetWeightKg != null &&
          set.targetWeightKg > 0,
      ),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameValid) return;
    if (!exercisesComplete) return;

    const savedExercises = renumber(
      exercises.map((exercise) => ({
        ...exercise,
        name: exercise.name.trim(),
        exerciseId: exerciseIdForName(exercise.name),
      })),
    );

    const routine: Routine = editing
      ? {
          ...initialRoutine,
          name: name.trim(),
          description: description.trim() || undefined,
          updatedAt: new Date().toISOString(),
          exercises: savedExercises,
        }
      : { ...createRoutine({ name, description }), exercises: savedExercises };

    onSave(routine);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back"
          className="self-start text-sm text-ink-2 transition-colors duration-100 hover:text-ink"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold">
          {editing ? 'Edit routine' : 'New routine'}
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <TextField
          label="Routine name"
          value={name}
          onChange={setName}
          placeholder="e.g. Push Day"
          maxLength={60}
          required
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="e.g. Chest, delts and triceps"
          maxLength={200}
        />
      </div>

      <hr className="border-line" />

      <ExerciseList exercises={exercises} onChange={setExercises} />

      <div className="mt-auto flex flex-col gap-2">
        <Button
          type="submit"
          disabled={!nameValid || !exercisesComplete}
          className="w-full"
        >
          Save routine
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default RoutineEditor;
