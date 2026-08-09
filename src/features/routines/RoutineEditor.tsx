import { useState, type FormEvent } from 'react';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { createRoutine } from '../../types/factories';
import type { Routine } from '../../types/models';

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

  const nameValid = name.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameValid) return;

    const routine: Routine = editing
      ? {
          ...initialRoutine,
          name: name.trim(),
          description: description.trim() || undefined,
          updatedAt: new Date().toISOString(),
        }
      : createRoutine({ name, description });

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

      <div className="mt-auto flex flex-col gap-2">
        <Button type="submit" disabled={!nameValid} className="w-full">
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
