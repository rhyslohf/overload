import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageProvider } from '../../components/StorageProvider';
import { createLocalStorageAdapter } from '../../services/localStorageAdapter';
import type { StorageService } from '../../services/storage';
import type { Routine } from '../../types/models';
import { createRoutine, createSetDefinition } from '../../types/factories';
import RoutinesHome from '../routines/RoutinesHome';
import { memoryStorage } from '../../test/memoryStorage';

function renderWithStorage(storage: StorageService) {
  render(
    <StorageProvider storage={storage}>
      <RoutinesHome />
    </StorageProvider>,
  );
}

function routineWithSets(name: string): Routine {
  return {
    ...createRoutine({ name }),
    exercises: [
      {
        id: 'ex-1',
        exerciseId: 'ex-id-bench',
        name: 'Bench Press',
        order: 0,
        sets: [
          createSetDefinition(0, { targetReps: 10, targetWeightKg: 100 }),
          createSetDefinition(1, { targetReps: 8, targetWeightKg: 90 }),
        ],
      },
      {
        id: 'ex-2',
        exerciseId: 'ex-id-lat',
        name: 'Lat Pulldown',
        order: 1,
        sets: [createSetDefinition(0, { targetReps: 12, targetWeightKg: 60 })],
      },
    ],
  };
}

describe('WorkoutSessionView — start a workout', () => {
  const firstExercise = async () => {
    const heading = await screen.findByRole('heading', { name: 'Bench Press' });
    return heading.closest('li')!;
  };
  it('starting a workout snapshots the routine into a session', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Push Day' }),
    ).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();

    await waitFor(async () => {
      const sessions = await storage.listSessions();
      expect(sessions).toHaveLength(1);
      const session = sessions[0];
      expect(session.status).toBe('inProgress');
      expect(session.routineId).toBe((await storage.listRoutines())[0].id);
      expect(session.routineName).toBe('Push Day');
      expect(session.exercises.map((e) => e.name)).toEqual([
        'Bench Press',
        'Lat Pulldown',
      ]);
      expect(session.exercises[0].sets).toEqual([]);
    });
  });

  it('shows a planned set row for each snapshotted set', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    expect(await screen.findByText('Bench Press')).toBeInTheDocument();
    expect(screen.getAllByText('Set 1')).toHaveLength(2);
    expect(screen.getAllByText('Set 2')).toHaveLength(1);
    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();
  });

  it('logs a set with weight, reps and difficulty and saves it', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    const weight = (
      await within(exercise).findAllByLabelText(/Weight \(kg\)/)
    )[0];
    const reps = within(exercise).getAllByLabelText(/Reps/)[0];
    await user.clear(weight);
    await user.type(weight, '102.5');
    await user.clear(reps);
    await user.type(reps, '8');
    await user.click(
      within(exercise).getAllByRole('button', {
        name: /Difficulty 4/,
      })[0],
    );
    await user.click(
      within(exercise).getAllByRole('button', { name: 'Log set' })[0],
    );

    expect(
      await screen.findByText(/Logged · 102\.5 kg × 8 · difficulty 4/),
    ).toBeInTheDocument();

    await waitFor(async () => {
      const sessions = await storage.listSessions();
      const routine = (await storage.listRoutines())[0];
      const set = sessions[0].exercises[0].sets[0];
      expect(set.setDefId).toBe(routine.exercises[0].sets[0].id);
      expect(set).toMatchObject({
        weightKg: 102.5,
        reps: 8,
        difficulty: 4,
      });
      expect(set.completedAt).toBeTruthy();
    });
  });

  it('keeps Log set disabled until difficulty and numbers are filled in', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    const logButton = (
      await within(exercise).findAllByRole('button', { name: 'Log set' })
    )[0];
    expect(logButton).toBeDisabled();

    await user.click(
      within(exercise).getAllByRole('button', {
        name: /Difficulty 3/,
      })[0],
    );
    expect(logButton).toBeEnabled();
  });

  it('prefills a to-failure set with a blank reps field', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    const routine = routineWithSets('Push Day');
    routine.exercises[0].sets = [
      createSetDefinition(0, { toFailure: true, targetWeightKg: 100 }),
    ];
    await storage.upsertRoutine(routine);
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    const reps = (await within(exercise).findAllByLabelText(/Reps/))[0];
    expect((reps as HTMLInputElement).value).toBe('');
  });

  it('logs a myorep activation set then adds repeatable mini-sets', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    const routine = routineWithSets('Push Day');
    routine.exercises[0].sets = [
      createSetDefinition(0, {
        isMyorep: true,
        myorep: {
          activationRepTarget: 12,
          miniSetRepTarget: 3,
          miniSetRestSeconds: 20,
          maxMiniSets: 5,
        },
        targetWeightKg: 100,
      }),
    ];
    await storage.upsertRoutine(routine);
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    const reps = (await within(exercise).findAllByLabelText(/Reps/))[0];
    await user.clear(reps);
    await user.type(reps, '12');
    await user.click(
      within(exercise).getAllByRole('button', { name: /Difficulty 3/ })[0],
    );
    await user.click(
      within(exercise).getAllByRole('button', { name: 'Log set' })[0],
    );

    expect(
      await within(exercise).findByText(/Activation · 100 kg × 12/),
    ).toBeInTheDocument();

    const miniReps = (
      await within(exercise).findAllByLabelText(/Mini-set reps/)
    )[0];
    await user.clear(miniReps);
    await user.type(miniReps, '4');
    await user.click(
      within(exercise).getByRole('button', { name: 'Add mini-set' }),
    );
    await user.clear(miniReps);
    await user.type(miniReps, '3');
    await user.click(
      within(exercise).getByRole('button', { name: 'Add mini-set' }),
    );

    expect(
      await within(exercise).findByText('Mini-set 1 · 4 reps'),
    ).toBeInTheDocument();
    expect(
      within(exercise).getByText('Mini-set 2 · 3 reps'),
    ).toBeInTheDocument();

    await waitFor(async () => {
      const sessions = await storage.listSessions();
      const set = sessions[0].exercises[0].sets[0];
      expect(set.myorepMiniSets).toEqual([{ reps: 4 }, { reps: 3 }]);
      expect(set.weightKg).toBe(100);
      expect(set.reps).toBe(12);
    });
  });

  it('marks a myorep set done to collapse the mini-set adder', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    const routine = routineWithSets('Push Day');
    routine.exercises[0].sets = [
      createSetDefinition(0, {
        isMyorep: true,
        myorep: {
          activationRepTarget: 12,
          miniSetRepTarget: 3,
          miniSetRestSeconds: 20,
          maxMiniSets: 5,
        },
        targetWeightKg: 100,
      }),
    ];
    await storage.upsertRoutine(routine);
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    const reps = (await within(exercise).findAllByLabelText(/Reps/))[0];
    await user.clear(reps);
    await user.type(reps, '12');
    await user.click(
      within(exercise).getAllByRole('button', { name: /Difficulty 3/ })[0],
    );
    await user.click(
      within(exercise).getAllByRole('button', { name: 'Log set' })[0],
    );
    await user.click(
      await within(exercise).findByRole('button', { name: 'Mark myorep done' }),
    );

    expect(
      within(exercise).queryByRole('button', { name: 'Add mini-set' }),
    ).not.toBeInTheDocument();
    expect(
      await within(exercise).findByText(/Logged · 100 kg × 12/),
    ).toBeInTheDocument();
  });

  it('adds an unplanned set without a set definition', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    await user.click(
      within(exercise).getByRole('button', { name: '+ Add set' }),
    );

    const weightLabel =
      await within(exercise).findByLabelText('Extra Weight (kg)');
    const extraRow = weightLabel.closest('li')!;
    const weight = weightLabel;
    const reps = within(extraRow).getByLabelText('Extra Reps');
    await user.clear(weight);
    await user.type(weight, '55');
    await user.clear(reps);
    await user.type(reps, '12');
    await user.click(
      within(extraRow).getByRole('button', { name: /Difficulty 2/ }),
    );
    await user.click(within(extraRow).getByRole('button', { name: 'Log set' }));

    await waitFor(async () => {
      const sessions = await storage.listSessions();
      const exercise0 = sessions[0].exercises[0];
      expect(exercise0.sets).toHaveLength(1);
      const logged = exercise0.sets[0];
      expect(logged).toMatchObject({ weightKg: 55, reps: 12, difficulty: 2 });
      const plannedIds = (
        await storage.listRoutines()
      )[0].exercises[0].sets.map((s) => s.id);
      expect(plannedIds).not.toContain(logged.setDefId);
    });
  });

  it('adds an unplanned set even with no planned sets', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    await user.click(
      within(exercise).getByRole('button', { name: '+ Add set' }),
    );
    expect(
      await within(exercise).findByLabelText('Extra Weight (kg)'),
    ).toBeInTheDocument();
  });

  it('skips a planned set and collapses its row', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    await user.click(
      within(exercise).getAllByRole('button', {
        name: 'Skip this set',
      })[0],
    );

    expect(await within(exercise).findByText('Skipped')).toBeInTheDocument();
    const skipped = within(exercise).getByText('Skipped');
    expect(within(skipped.closest('li')!).queryByText('Log set')).toBeNull();

    await waitFor(async () => {
      const sessions = await storage.listSessions();
      const exercise0 = sessions[0].exercises[0];
      const planned = (await storage.listRoutines())[0].exercises[0].sets;
      expect(exercise0.skippedSetDefIds).toEqual([planned[0].id]);
    });
  });

  it('returns to the routine list via Back', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );
    await user.click(await screen.findByRole('button', { name: /← Routines/ }));

    expect(
      screen.getByRole('button', { name: /Push Day/ }),
    ).toBeInTheDocument();
  });

  it('auto-starts the rest timer when a set is logged', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    expect(
      await screen.findByRole('button', { name: /Rest timer, 0:00, idle/ }),
    ).toBeInTheDocument();

    const exercise = await firstExercise();
    const reps = (await within(exercise).findAllByLabelText(/Reps/))[0];
    await user.clear(reps);
    await user.type(reps, '10');
    await user.click(
      within(exercise).getAllByRole('button', { name: /Difficulty 3/ })[0],
    );
    await user.click(
      within(exercise).getAllByRole('button', { name: 'Log set' })[0],
    );

    expect(
      await screen.findByRole('button', {
        name: /Rest timer, \d+:\d+, running/,
      }),
    ).toBeInTheDocument();
  });

  it('finishes the session as completed with a timestamp', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Finish workout' }),
    );

    expect(
      await screen.findByRole('button', { name: /Push Day/ }),
    ).toBeInTheDocument();
    await waitFor(async () => {
      const sessions = await storage.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('completed');
      expect(sessions[0].completedAt).toBeTruthy();
    });
  });

  it('abandons the session and keeps it out of the resume list', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Abandon session' }),
    );

    expect(
      await screen.findByRole('button', { name: /Push Day/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Resume/)).not.toBeInTheDocument();
    await waitFor(async () => {
      const sessions = await storage.listSessions();
      expect(sessions[0].status).toBe('abandoned');
      expect(sessions[0].completedAt).toBeTruthy();
    });
  });
});
