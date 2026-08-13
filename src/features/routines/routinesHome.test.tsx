import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { StorageProvider } from '../../components/StorageProvider';
import type { StorageService } from '../../services/storage';
import { createLocalStorageAdapter } from '../../services/localStorageAdapter';
import { exportRoutine } from '../../services/exportImport';
import type {
  parseRoutineImport,
  deconflictRoutineName,
  ImportError,
} from '../../services/exportImport';
import type { Routine, WorkoutSession } from '../../types/models';
import {
  createRoutine,
  createRoutineExercise,
  createWorkoutSession,
} from '../../types/factories';
import RoutinesHome from './RoutinesHome';
import { memoryStorage } from '../../test/memoryStorage';
import { createFlakyStorage } from '../../test/flakyStorage';

vi.mock('../../services/exportImport', async () => {
  const actual = await vi.importActual<{
    parseRoutineImport: typeof parseRoutineImport;
    deconflictRoutineName: typeof deconflictRoutineName;
    ImportError: typeof ImportError;
  }>('../../services/exportImport');
  return {
    ...actual,
    exportRoutine: vi.fn(),
  };
});

function renderRoutines(): StorageService {
  const storage: StorageService = createLocalStorageAdapter(memoryStorage());
  render(
    <StorageProvider storage={storage}>
      <RoutinesHome />
    </StorageProvider>,
  );
  return storage;
}

async function seedRoutine(
  storage: StorageService,
  name: string,
  exerciseName?: string,
) {
  const routine: Routine = {
    ...createRoutine({ name }),
    exercises: exerciseName
      ? [
          {
            id: `ex-seed-${name}`,
            exerciseId: `ex-id-${exerciseName}`,
            name: exerciseName,
            order: 0,
            sets: [],
          },
        ]
      : [],
  };
  await storage.upsertRoutine(routine);
}

describe('RoutinesHome — create routine', () => {
  it('shows the empty state plus a New routine action', async () => {
    renderRoutines();

    expect(
      await screen.findByText('No routines yet — build your first one.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New routine' }),
    ).toBeInTheDocument();
  });

  it('opens the editor and disables Save until a name is typed', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));

    expect(
      screen.getByRole('heading', { name: 'New routine' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save routine' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    expect(screen.getByRole('button', { name: 'Save routine' })).toBeEnabled();
  });

  it('saves a new routine with name and description through storage', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.type(
      screen.getByLabelText(/Description \(optional\)/),
      'Chest and delts',
    );
    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      expect(routines).toHaveLength(1);
      expect(routines[0].name).toBe('Push Day');
      expect(routines[0].description).toBe('Chest and delts');
      expect(routines[0].exercises).toEqual([]);
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Routine “Push Day” saved.',
    );
  });

  it('does not save a blank description', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Leg Day');
    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      expect(routines[0].description).toBeUndefined();
    });
  });

  it('cancels back to the list without saving', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(
      screen.getByLabelText(/Routine name/),
      'Should Be Discarded',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      screen.getByRole('heading', { name: 'Routines' }),
    ).toBeInTheDocument();
    await expect(storage.listRoutines()).resolves.toEqual([]);
  });
});

describe('RoutinesHome — add/remove/reorder exercises', () => {
  it('adds exercises and saves them with correct order', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');

    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');

    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 2/), 'Overhead Press');

    await user.type(screen.getByLabelText(/Exercise 1/), '{end}'); // no-op to satisfy sequential typing; keeps field intact
    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      expect(routines).toHaveLength(1);
      expect(routines[0].exercises.map((e) => e.name)).toEqual([
        'Bench Press',
        'Overhead Press',
      ]);
      expect(routines[0].exercises.map((e) => e.order)).toEqual([0, 1]);
    });
  });

  it('reorders exercises up and re-numbers them', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');

    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 2/), 'Overhead Press');

    await user.click(
      screen.getByRole('button', { name: /Move Overhead Press up/ }),
    );

    expect(screen.getByLabelText(/Exercise 1/)).toHaveValue('Overhead Press');
    expect(screen.getByLabelText(/Exercise 2/)).toHaveValue('Bench Press');
  });

  it('removes an exercise', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');

    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 2/), 'Overhead Press');

    await user.click(
      screen.getByRole('button', { name: /Remove Bench Press/ }),
    );

    expect(screen.getByLabelText(/Exercise 1/)).toHaveValue('Overhead Press');
    expect(screen.queryByLabelText(/Exercise 2/)).not.toBeInTheDocument();
  });

  it('keeps Save disabled until every exercise has a name', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));

    expect(screen.getByRole('button', { name: 'Save routine' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
    expect(screen.getByRole('button', { name: 'Save routine' })).toBeEnabled();
  });
});

describe('RoutinesHome — add/remove/reorder sets', () => {
  async function newRoutineWithExercise(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
  }

  it('adds sets with reps and weight, saving them in order', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await newRoutineWithExercise(user);

    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 reps/), '10');
    await user.type(screen.getByLabelText(/Set 1 weight/), '60');

    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 2 reps/), '5');
    await user.type(screen.getByLabelText(/Set 2 weight/), '80');

    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      const sets = routines[0].exercises[0].sets;
      expect(sets.map((s) => s.targetReps)).toEqual([10, 5]);
      expect(sets.map((s) => s.targetWeightKg)).toEqual([60, 80]);
      expect(sets.map((s) => s.order)).toEqual([0, 1]);
    });
  });

  it('reorders sets with the move buttons', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithExercise(user);

    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 reps/), '10');
    await user.type(screen.getByLabelText(/Set 1 weight/), '60');
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 2 reps/), '5');
    await user.type(screen.getByLabelText(/Set 2 weight/), '80');

    await user.click(screen.getByRole('button', { name: 'Move set 2 up' }));

    expect(screen.getByLabelText(/Set 1 reps/)).toHaveValue(5);
    expect(screen.getByLabelText(/Set 1 weight/)).toHaveValue(80);
    expect(screen.getByLabelText(/Set 2 reps/)).toHaveValue(10);
    expect(screen.getByLabelText(/Set 2 weight/)).toHaveValue(60);
  });

  it('removes a set', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithExercise(user);

    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 reps/), '10');
    await user.type(screen.getByLabelText(/Set 1 weight/), '60');
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 2 reps/), '5');
    await user.type(screen.getByLabelText(/Set 2 weight/), '80');

    await user.click(screen.getByRole('button', { name: 'Remove set 1' }));

    expect(screen.getByLabelText(/Set 1 reps/)).toHaveValue(5);
    expect(screen.queryByLabelText(/Set 2 reps/)).not.toBeInTheDocument();
  });

  it('keeps Save disabled until every set has reps and weight', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithExercise(user);

    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 reps/), '10');

    expect(screen.getByRole('button', { name: 'Save routine' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Set 1 weight/), '60');
    expect(screen.getByRole('button', { name: 'Save routine' })).toBeEnabled();
  });
});

describe('RoutinesHome — to-failure toggle', () => {
  async function newRoutineWithExercise(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
  }

  it('hides the reps field and saves a to-failure set', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await newRoutineWithExercise(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 weight/), '60');
    await user.click(screen.getByRole('switch', { name: /Set 1 to failure/ }));

    expect(screen.queryByLabelText(/Set 1 reps/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /Set 1 to failure/ }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Save routine' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      const set = routines[0].exercises[0].sets[0];
      expect(set.toFailure).toBe(true);
      expect(set.targetReps).toBeUndefined();
      expect(set.targetWeightKg).toBe(60);
    });
  });

  it('shows reps again after toggling off', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithExercise(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.click(screen.getByRole('switch', { name: /Set 1 to failure/ }));
    await user.click(screen.getByRole('switch', { name: /Set 1 to failure/ }));

    expect(screen.getByLabelText(/Set 1 reps/)).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /Set 1 to failure/ }),
    ).toHaveAttribute('aria-checked', 'false');
  });
});

describe('RoutinesHome — myorep toggle & config', () => {
  async function newRoutineWithExercise(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
  }

  it('reveals myorep config with defaults and saves it', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await newRoutineWithExercise(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 weight/), '60');
    await user.click(screen.getByRole('switch', { name: /Set 1 Myorep/i }));

    expect(screen.getByLabelText(/Set 1 mini-set rest/)).toHaveValue(20);

    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      const set = routines[0].exercises[0].sets[0];
      expect(set.isMyorep).toBe(true);
      expect(set.myorep).toMatchObject({
        activationRepTarget: 15,
        miniSetRepTarget: 3,
        miniSetRestSeconds: 20,
      });
      expect(set.targetWeightKg).toBe(60);
    });
  });

  it('hides the plain reps field when myorep is on', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithExercise(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.click(screen.getByRole('switch', { name: /Set 1 Myorep/i }));

    expect(screen.queryByLabelText(/Set 1 reps/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Set 1 activation reps/)).toBeInTheDocument();
  });

  it('can edit the myorep activation / mini-set values', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await newRoutineWithExercise(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 weight/), '40');
    await user.click(screen.getByRole('switch', { name: /Set 1 Myorep/i }));

    await user.clear(screen.getByLabelText(/Set 1 activation reps/));
    await user.type(screen.getByLabelText(/Set 1 activation reps/), '12');
    await user.clear(screen.getByLabelText(/Set 1 mini-set reps/));
    await user.type(screen.getByLabelText(/Set 1 mini-set reps/), '5');

    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      const set = routines[0].exercises[0].sets[0];
      expect(set.myorep?.activationRepTarget).toBe(12);
      expect(set.myorep?.miniSetRepTarget).toBe(5);
    });
  });

  it('keeps Save disabled if mini-set rest is cleared', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithExercise(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 weight/), '40');
    await user.click(screen.getByRole('switch', { name: /Set 1 Myorep/i }));

    await user.clear(screen.getByLabelText(/Set 1 mini-set rest/));

    expect(screen.getByRole('button', { name: 'Save routine' })).toBeDisabled();
  });
});

describe('RoutinesHome — warm-up toggle', () => {
  it('marks a set as warm-up and saves it', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 reps/), '10');
    await user.type(screen.getByLabelText(/Set 1 weight/), '40');
    await user.click(screen.getByRole('switch', { name: /Set 1 warm up/i }));

    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      expect(routines[0].exercises[0].sets[0].isWarmup).toBe(true);
    });
  });
});

describe('RoutinesHome — percentage-of-set', () => {
  async function newRoutineWithTwoSets(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 reps/), '10');
    await user.type(screen.getByLabelText(/Set 1 weight/), '100');
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 2 reps/), '10');
  }

  it('defaults source to the preceding set and shows a computed weight', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithTwoSets(user);
    await user.click(
      screen.getByRole('switch', { name: /Set 2 percent of set/ }),
    );

    const option = screen.getByRole('option', { name: /Set 1 \(100 kg\)/ });
    expect((option as HTMLOptionElement).selected).toBe(true);
    expect(screen.getByText(/Load 80 kg/)).toBeInTheDocument();
  });

  it('saves the percentage as the set weight mode', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await newRoutineWithTwoSets(user);
    await user.click(
      screen.getByRole('switch', { name: /Set 2 percent of set/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      const set = routines[0].exercises[0].sets[1];
      expect(set.weightMode).toBe('percentageOfSet');
      expect(set.percentageOf?.percent).toBe(80);
      expect(set.percentageOf?.sourceSetId).toBe(
        routines[0].exercises[0].sets[0].id,
      );
      expect(set.targetWeightKg).toBeUndefined();
    });
  });

  it('recomputes the load when source weight or percent changes', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithTwoSets(user);
    await user.click(
      screen.getByRole('switch', { name: /Set 2 percent of set/ }),
    );

    await user.clear(screen.getByRole('spinbutton', { name: /percent/ }));
    await user.type(screen.getByRole('spinbutton', { name: /percent/ }), '50');

    expect(screen.getByText(/Load 50 kg/)).toBeInTheDocument();
  });

  it('keeps Save disabled until a percentage is entered', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithTwoSets(user);
    await user.click(
      screen.getByRole('switch', { name: /Set 2 percent of set/ }),
    );
    await user.clear(screen.getByRole('spinbutton', { name: /percent/ }));

    expect(screen.getByRole('button', { name: 'Save routine' })).toBeDisabled();
  });

  it('disables Save when reordering moves the base set after the percentage set', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithTwoSets(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.click(
      screen.getByRole('switch', { name: /Set 3 percent of set/ }),
    );
    // The base is Set 2; moving it below Set 3 makes the reference invalid.
    await user.click(screen.getByRole('button', { name: /Move set 2 down/ }));

    expect(screen.getByRole('button', { name: 'Save routine' })).toBeDisabled();
    expect(
      screen.getByText(/base set is missing or after this set/),
    ).toBeInTheDocument();
  });

  it('disables Save when the base set is removed', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithTwoSets(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.click(
      screen.getByRole('switch', { name: /Set 3 percent of set/ }),
    );
    await user.click(screen.getByRole('button', { name: /Remove set 2/ }));

    expect(screen.getByRole('button', { name: 'Save routine' })).toBeDisabled();
    expect(
      screen.getByText(/base set is missing or after this set/),
    ).toBeInTheDocument();
  });

  it('lets the user repoint a broken percentage reference to a valid earlier set', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await newRoutineWithTwoSets(user);
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 3 reps/), '8');
    await user.click(
      screen.getByRole('switch', { name: /Set 3 percent of set/ }),
    );
    // Remove the immediate base (Set 2); Set 3 is renumbered Set 2 and may
    // still reference Set 1.
    await user.click(screen.getByRole('button', { name: /Remove set 2/ }));

    const select = screen.getByLabelText(/Set 2 based on/);
    await user.selectOptions(select, select.querySelector('option')!.value);

    expect(screen.getByRole('button', { name: 'Save routine' })).toBeEnabled();
  });
});

describe('RoutinesHome — list & select saved routines', () => {
  async function saveRoutine(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), name);
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
  }

  it('marks warm-up sets in the detail view', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'Bench Press');
    await user.click(screen.getByRole('button', { name: 'Add set' }));
    await user.type(screen.getByLabelText(/Set 1 reps/), '10');
    await user.type(screen.getByLabelText(/Set 1 weight/), '40');
    await user.click(screen.getByRole('switch', { name: /Set 1 warm up/i }));
    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await user.click(screen.getByRole('button', { name: /Push Day/ }));

    expect(screen.getByText(/Warm-up · 10 × 40 kg/)).toBeInTheDocument();
  });

  it('lists saved routines with their exercise count', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await saveRoutine(user, 'Push Day');
    await saveRoutine(user, 'Leg Day');

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      expect(routines).toHaveLength(2);
    });

    expect(
      screen.getByRole('button', { name: /Push Day/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Leg Day/ })).toBeInTheDocument();
  });

  it('selecting a routine shows its detail view', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await saveRoutine(user, 'Push Day');

    await user.click(screen.getByRole('button', { name: /Push Day/ }));

    expect(
      await screen.findByRole('heading', { name: 'Push Day' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Routines/ }),
    ).toBeInTheDocument();
  });

  it('back from detail returns to the list', async () => {
    const user = userEvent.setup();
    renderRoutines();

    await saveRoutine(user, 'Push Day');
    await user.click(screen.getByRole('button', { name: /Push Day/ }));
    await user.click(screen.getByRole('button', { name: /Routines/ }));

    expect(
      screen.getByRole('button', { name: /Push Day/ }),
    ).toBeInTheDocument();
  });
});

describe('RoutinesHome — edit & delete a routine', () => {
  async function saveRoutine(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), name);
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
  }

  it('edits a routine name through the detail view', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await saveRoutine(user, 'Push Day');
    await user.click(screen.getByRole('button', { name: /Push Day/ }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(
      await screen.findByRole('heading', { name: 'Edit routine' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Routine name/)).toHaveValue('Push Day');

    await user.clear(screen.getByLabelText(/Routine name/));
    await user.type(screen.getByLabelText(/Routine name/), 'Upper Push');
    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      expect(routines[0].name).toBe('Upper Push');
    });
  });

  it('deletes a routine', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    await saveRoutine(user, 'Push Day');
    await user.click(screen.getByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Delete Push Day' }),
    );

    expect(
      await screen.findByText('No routines yet — build your first one.'),
    ).toBeInTheDocument();
    await waitFor(async () => {
      expect(await storage.listRoutines()).toEqual([]);
    });
  });
});

describe('RoutinesHome — exercise-name autocomplete', () => {
  it('suggests matching exercises from the library', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();
    await seedRoutine(storage, 'Seeded', 'Bench Press');

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'ben');

    expect(
      await screen.findByRole('option', { name: 'Bench Press' }),
    ).toBeInTheDocument();
  });

  it('picks a suggestion by click into the exercise name', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();
    await seedRoutine(storage, 'Seeded', 'Overhead Press');

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText(/Exercise 1/), 'over');

    const option = await screen.findByRole('option', {
      name: 'Overhead Press',
    });
    await user.click(option);

    expect(screen.getByLabelText(/Exercise 1/)).toHaveValue('Overhead Press');
  });

  it('announces the highlighted suggestion via aria-activedescendant', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();
    await seedRoutine(storage, 'Seeded', 'Bench Press');
    await seedRoutine(storage, 'Seeded 2', 'Incline Press');

    await user.click(screen.getByRole('button', { name: 'New routine' }));
    await user.type(screen.getByLabelText(/Routine name/), 'Push Day');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    const input = screen.getByLabelText(/Exercise 1/);
    await user.type(input, 'press');

    const options = await screen.findAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);

    await user.keyboard('{ArrowDown}');

    const highlighted = screen
      .getAllByRole('option')
      .find((option) => option.getAttribute('data-selected') === 'true');
    const inputWithActivedescendant = screen.getByLabelText(/Exercise 1/);
    expect(
      inputWithActivedescendant.getAttribute('aria-activedescendant'),
    ).toBe(highlighted?.id);

    await user.keyboard('{Enter}');

    expect(screen.getByLabelText(/Exercise 1/)).toHaveValue(
      highlighted?.textContent,
    );
  });

  it('shows a resume banner when an in-progress session exists', async () => {
    const storage = createLocalStorageAdapter(memoryStorage());
    await seedRoutine(storage, 'Seeded', 'Bench Press');
    const routine = (await storage.listRoutines())[0];
    const session: WorkoutSession = {
      ...createWorkoutSession(routine),
      startedAt: new Date('2026-08-10T09:00:00').toISOString(),
    };
    await storage.upsertSession(session);
    render(
      <StorageProvider storage={storage}>
        <RoutinesHome />
      </StorageProvider>,
    );

    expect(await screen.findByText(/Resume “Seeded”/)).toBeInTheDocument();
  });

  it('resumes the in-progress session into the workout view', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await seedRoutine(storage, 'Seeded', 'Bench Press');
    const routine = (await storage.listRoutines())[0];
    await storage.upsertSession(createWorkoutSession(routine));
    render(
      <StorageProvider storage={storage}>
        <RoutinesHome />
      </StorageProvider>,
    );

    const resume = await screen.findByRole('button', {
      name: /Resume “Seeded”/,
    });
    await user.click(resume);

    expect(
      await screen.findByRole('heading', { name: 'Seeded' }),
    ).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('shows no resume banner once the in-progress session is completed', async () => {
    const storage = createLocalStorageAdapter(memoryStorage());
    await seedRoutine(storage, 'Seeded', 'Bench Press');
    const routine = (await storage.listRoutines())[0];
    const session = {
      ...createWorkoutSession(routine),
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
    };
    await storage.upsertSession(session);
    render(
      <StorageProvider storage={storage}>
        <RoutinesHome />
      </StorageProvider>,
    );

    await screen.findByText('Seeded');
    expect(screen.queryByText(/Resume “Seeded”/)).not.toBeInTheDocument();
  });
});

describe('RoutineDetail — export', () => {
  it('exports the routine to a JSON download', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await seedRoutine(storage, 'Push Day', 'Bench Press');
    const routine = (await storage.listRoutines())[0];
    render(
      <StorageProvider storage={storage}>
        <RoutinesHome />
      </StorageProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(await screen.findByRole('button', { name: 'Export' }));

    expect(exportRoutine).toHaveBeenCalledWith(routine);
  });
});

describe('RoutinesHome — import routine', () => {
  it('imports a routine-export.json file into the list', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();

    const imported: Routine = {
      ...createRoutine({ name: 'Pull Day' }),
      exercises: [createRoutineExercise({ name: 'Row', order: 0, sets: [] })],
    };
    const file = new File(
      [
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          routine: imported,
        }),
      ],
      'routine-export.json',
      { type: 'application/json' },
    );

    await user.upload(screen.getByLabelText(/import routine/i), file);

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      expect(routines).toHaveLength(1);
      expect(routines[0].name).toBe('Pull Day');
    });

    expect(
      await screen.findByRole('button', { name: /Pull Day/ }),
    ).toBeInTheDocument();
  });

  it('renames an imported routine on a name collision', async () => {
    const user = userEvent.setup();
    const storage = renderRoutines();
    await seedRoutine(storage, 'Push Day', 'Bench Press');

    const imported: Routine = {
      ...createRoutine({ name: 'Push Day' }),
      exercises: [],
    };
    const file = new File(
      [
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          routine: imported,
        }),
      ],
      'routine-export.json',
      { type: 'application/json' },
    );

    await user.upload(screen.getByLabelText(/import routine/i), file);

    await waitFor(async () => {
      const routines = await storage.listRoutines();
      expect(routines).toHaveLength(2);
      expect(routines.some((r) => r.name === 'Push Day (copy)')).toBe(true);
    });
  });
});

describe('RoutinesHome — load error', () => {
  it('shows an error state with Retry, then recovers', async () => {
    const user = userEvent.setup();
    const base = createLocalStorageAdapter(memoryStorage());
    const flaky = createFlakyStorage(base);
    render(
      <StorageProvider storage={flaky}>
        <RoutinesHome />
      </StorageProvider>,
    );

    expect(
      await screen.findByText(/Couldn't load your routines/),
    ).toBeInTheDocument();

    flaky.enable();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByText('No routines yet — build your first one.'),
    ).toBeInTheDocument();
  });
});
