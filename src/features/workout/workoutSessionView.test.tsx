import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageProvider } from '../../components/StorageProvider';
import { createLocalStorageAdapter } from '../../services/localStorageAdapter';
import type { StorageService } from '../../services/storage';
import type { Routine, WorkoutSession } from '../../types/models';
import {
  createLoggedSet,
  createRoutine,
  createSetDefinition,
  createWorkoutSession,
} from '../../types/factories';
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

function routineWithBodyweight(name: string): Routine {
  return {
    ...createRoutine({ name }),
    exercises: [
      {
        id: 'ex-bw',
        exerciseId: 'ex-id-pullup',
        name: 'Pull-Up',
        order: 0,
        sets: [
          createSetDefinition(0, {
            targetReps: 8,
            weightMode: 'bodyweight',
            bodyweight: { addedWeightKg: 5 },
          }),
        ],
      },
    ],
  };
}

describe('WorkoutSessionView — start a workout', () => {
  const firstExercise = async () => {
    const heading = await screen.findByRole('heading', { name: 'Bench Press' });
    return heading.closest('li')!;
  };
  const firstExerciseFor = async (name: string) => {
    const heading = await screen.findByRole('heading', { name });
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

  it('collapses every exercise and opens only the first one', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    // First exercise is open and shows its planned sets.
    const bench = await firstExercise();
    expect(within(bench).getByText(/^Set 1$/)).toBeInTheDocument();
    expect(within(bench).getByText(/^Set 2$/)).toBeInTheDocument();
    expect(
      within(bench).getByRole('button', { name: '+ Add set' }),
    ).toBeInTheDocument();

    // Later exercises stay collapsed — header only, no set rows.
    const lat = await firstExerciseFor('Lat Pulldown');
    expect(
      within(lat).getByRole('button', { name: 'Expand Lat Pulldown' }),
    ).toBeInTheDocument();
    expect(within(lat).queryByText(/^Set /)).not.toBeInTheDocument();
    expect(
      within(lat).queryByRole('button', { name: '+ Add set' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Set 1$/)).toHaveLength(1);
    expect(screen.getAllByText(/^Set 2$/)).toHaveLength(1);
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

  it('logs a bodyweight set with its added weight flagged', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithBodyweight('Pull Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Pull Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExerciseFor('Pull-Up');
    const added = await within(exercise).findByLabelText(/Added weight \(kg\)/);
    await user.clear(added);
    await user.type(added, '6');
    const reps = within(exercise).getByLabelText(/Reps/);
    await user.clear(reps);
    await user.type(reps, '10');
    await user.click(
      within(exercise).getByRole('button', { name: /Difficulty 2/ }),
    );
    await user.click(within(exercise).getByRole('button', { name: 'Log set' }));

    // The one planned set completes the exercise → it auto-collapses.
    expect(await screen.findByText('✓ Done')).toBeInTheDocument();
    // Re-open it to review the read-only logged row.
    await user.click(
      await screen.findByRole('button', { name: 'Expand Pull-Up' }),
    );
    expect(
      await screen.findByText(/Logged · Bodyweight \+ 6 kg × 10/),
    ).toBeInTheDocument();

    await waitFor(async () => {
      const sessions = await storage.listSessions();
      expect(sessions[0].exercises[0].sets[0]).toMatchObject({
        weightKg: 6,
        reps: 10,
        difficulty: 2,
        isBodyweight: true,
      });
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
    // The exercise finishes and auto-collapses, flagged done in its header.
    expect(await screen.findByText('✓ Done')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Expand Bench Press' }),
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

  it('prefills an easy-reps-met set with a bumped suggested weight', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    const routine = routineWithSets('Push Day');
    await storage.upsertRoutine(routine);
    // Prior session: set 1 of the same routine was easy (10 reps ≥ target 10).
    const prior: WorkoutSession = {
      ...createWorkoutSession(routine),
      status: 'completed',
      completedAt: '2026-08-01T00:00:00.000Z',
      exercises: [
        {
          ...createWorkoutSession(routine).exercises[0],
          id: 'ex-1',
          sets: [
            createLoggedSet({
              setDefId: routine.exercises[0].sets[0].id,
              order: 0,
              weightKg: 100,
              reps: 10,
              difficulty: 2,
            }),
          ],
        },
        createWorkoutSession(routine).exercises[1],
      ],
    };
    await storage.upsertSession(prior);
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const exercise = await firstExercise();
    const weight = (
      await within(exercise).findAllByLabelText(/Weight \(kg\)/)
    )[0];
    // 100 kg × 1.025 rounds to the 2.5 kg plate increment → 102.5.
    expect((weight as HTMLInputElement).value).toBe('102.5');
    expect(
      await within(exercise).findByText(/Suggested · Last time: 100 kg × 10/),
    ).toBeInTheDocument();
  });

  it('keeps the routine target when there is no prior history', async () => {
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
    expect((weight as HTMLInputElement).value).toBe('100');
    expect(screen.queryByText(/Suggested ·/)).not.toBeInTheDocument();
  });

  /** Fills and logs the next still-open row inside `exercise`. */
  async function logRow(
    user: ReturnType<typeof userEvent.setup>,
    exercise: HTMLElement,
    weightValue: string,
    repsValue: string,
  ) {
    const logButton = within(exercise).getAllByRole('button', {
      name: 'Log set',
    })[0];
    const row = logButton.closest('div')!;
    const weight = within(row).getByLabelText(/Weight \(kg\)/);
    const reps = within(row).getByLabelText(/Reps/);
    await user.clear(weight);
    await user.type(weight, weightValue);
    await user.clear(reps);
    await user.type(reps, repsValue);
    await user.click(within(row).getByRole('button', { name: /Difficulty 3/ }));
    await user.click(within(row).getByRole('button', { name: 'Log set' }));
  }

  it('auto-collapses a done exercise and opens the next one', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const bench = await firstExercise();
    await logRow(user, bench, '100', '10');
    await logRow(user, bench, '90', '8');

    const lat = await firstExerciseFor('Lat Pulldown');
    await waitFor(() => {
      expect(
        within(lat).getByRole('button', { name: 'Log set' }),
      ).toBeInTheDocument();
    });
    const benchNow = await firstExerciseFor('Bench Press');
    expect(
      within(benchNow).getByRole('button', { name: 'Expand Bench Press' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(benchNow).queryByRole('button', { name: '+ Add set' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the rest timer pinned above the active exercise', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const bench = await firstExercise();
    expect(
      within(bench).getByRole('button', { name: /Rest timer/ }),
    ).toBeInTheDocument();
    const lat = await firstExerciseFor('Lat Pulldown');
    expect(
      within(lat).queryByRole('button', { name: /Rest timer/ }),
    ).not.toBeInTheDocument();

    await logRow(user, bench, '100', '10');
    await logRow(user, bench, '90', '8');

    const latNow = await firstExerciseFor('Lat Pulldown');
    await waitFor(() => {
      expect(
        within(latNow).getByRole('button', { name: /Rest timer/ }),
      ).toBeInTheDocument();
    });
    const benchNow = await firstExerciseFor('Bench Press');
    expect(
      within(benchNow).queryByRole('button', { name: /Rest timer/ }),
    ).not.toBeInTheDocument();
  });

  it('lets the user expand a collapsed exercise to review it', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    const lat = await firstExerciseFor('Lat Pulldown');
    await user.click(
      within(lat).getByRole('button', { name: 'Expand Lat Pulldown' }),
    );

    const latNow = await firstExerciseFor('Lat Pulldown');
    expect(
      within(latNow).getByRole('button', { name: 'Log set' }),
    ).toBeInTheDocument();
    await user.click(
      within(latNow).getByRole('button', { name: 'Collapse Lat Pulldown' }),
    );
    expect(
      within(latNow).queryByRole('button', { name: 'Log set' }),
    ).not.toBeInTheDocument();
  });
});
