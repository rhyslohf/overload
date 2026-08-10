import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageProvider } from '../../components/StorageProvider';
import { createLocalStorageAdapter } from '../../services/localStorageAdapter';
import type { StorageService } from '../../services/storage';
import { memoryStorage } from '../../test/memoryStorage';
import type { Routine, WorkoutSession } from '../../types/models';
import {
  createLoggedSet,
  createRoutine,
  createSetDefinition,
  createWorkoutSession,
} from '../../types/factories';
import HistoryHome from './HistoryHome';

/** Build a finished session: one routine, one exercise, one logged set. */
async function buildFinishedSession(overrides?: {
  status?: WorkoutSession['status'];
  routineName?: string;
  loggedWeightKg?: number;
  loggedReps?: number;
}): Promise<{ storage: StorageService; session: WorkoutSession }> {
  const storage: StorageService = createLocalStorageAdapter(memoryStorage());
  const routine: Routine = {
    ...createRoutine({ name: 'Push Day' }),
    exercises: [
      {
        id: 'ex-seed',
        exerciseId: `ex-id-${overrides?.routineName ?? 'Push Day'}`,
        name: 'Bench Press',
        order: 0,
        sets: [createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 })],
      },
    ],
  };
  await storage.upsertRoutine(routine);

  const session = createWorkoutSession(routine);
  const finished: WorkoutSession = {
    ...session,
    routineName: overrides?.routineName ?? session.routineName,
    status: overrides?.status ?? 'completed',
    completedAt: '2026-08-10T12:00:00.000Z',
    exercises: [
      {
        ...session.exercises[0],
        sets: [
          {
            id: 'logged-seed',
            setDefId: 'set-1',
            order: 0,
            weightKg: overrides?.loggedWeightKg ?? 100,
            reps: overrides?.loggedReps ?? 8,
            difficulty: 4,
            completedAt: '2026-08-10T12:00:00.000Z',
          },
        ],
      },
    ],
  };
  await storage.upsertSession(finished);
  return { storage, session: finished };
}

describe('HistoryHome — list', () => {
  it('shows the empty state with no logged sessions', async () => {
    render(
      <StorageProvider storage={createLocalStorageAdapter(memoryStorage())}>
        <HistoryHome />
      </StorageProvider>,
    );

    expect(
      await screen.findByText(
        "No logged sessions yet. Finish a workout and it'll land here.",
      ),
    ).toBeInTheDocument();
  });

  it('lists a finished session with its name, status and set count', async () => {
    const { storage } = await buildFinishedSession();
    render(
      <StorageProvider storage={storage}>
        <HistoryHome />
      </StorageProvider>,
    );

    expect(
      await screen.findByRole('button', { name: /Push Day/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 set logged')).toBeInTheDocument();
  });

  it('only lists finished sessions, not in-progress ones', async () => {
    const { storage } = await buildFinishedSession({ status: 'inProgress' });
    render(
      <StorageProvider storage={storage}>
        <HistoryHome />
      </StorageProvider>,
    );

    expect(
      await screen.findByText(
        "No logged sessions yet. Finish a workout and it'll land here.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Push Day/ }),
    ).not.toBeInTheDocument();
  });

  it('opens the detail view when a session is tapped', async () => {
    const user = userEvent.setup();
    const { storage } = await buildFinishedSession();
    render(
      <StorageProvider storage={storage}>
        <HistoryHome />
      </StorageProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));

    expect(
      screen.getByRole('heading', { name: 'Push Day' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(
      screen.getByText(/Set 1 · 100 kg × 8 · difficulty 4/),
    ).toBeInTheDocument();
  });

  it('shows Abandoned status for an abandoned session', async () => {
    const { storage } = await buildFinishedSession({ status: 'abandoned' });
    render(
      <StorageProvider storage={storage}>
        <HistoryHome />
      </StorageProvider>,
    );

    expect(
      await screen.findByRole('button', { name: /Push Day/ }),
    ).toBeInTheDocument();
  });
});

describe('HistoryHome — detail', () => {
  it('back returns to the list', async () => {
    const user = userEvent.setup();
    const { storage } = await buildFinishedSession();
    render(
      <StorageProvider storage={storage}>
        <HistoryHome />
      </StorageProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(screen.getByRole('button', { name: '← History' }));

    expect(
      await screen.findByRole('button', { name: /Push Day/ }),
    ).toBeInTheDocument();
  });

  it('shows a session with an unlogged exercise as "No sets logged."', async () => {
    const storage: StorageService = createLocalStorageAdapter(memoryStorage());
    const routine: Routine = {
      ...createRoutine({ name: 'Push Day' }),
      exercises: [
        {
          id: 'ex-empty',
          exerciseId: 'ex-id-empty',
          name: 'Bench Press',
          order: 0,
          sets: [
            createSetDefinition(0, { targetReps: 8, targetWeightKg: 100 }),
          ],
        },
      ],
    };
    const session = createWorkoutSession(routine);
    await storage.upsertSession({
      ...session,
      status: 'completed',
      completedAt: '2026-08-10T12:00:00.000Z',
    });
    render(
      <StorageProvider storage={storage}>
        <HistoryHome />
      </StorageProvider>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Push Day/ }));

    expect(screen.getByText('No sets logged.')).toBeInTheDocument();
  });

  it('shows myorep mini-sets in the detail view', async () => {
    const storage: StorageService = createLocalStorageAdapter(memoryStorage());
    const routine: Routine = {
      ...createRoutine({ name: 'Push Day' }),
      exercises: [
        {
          id: 'ex-myo',
          exerciseId: 'ex-id-myorep',
          name: 'Curls',
          order: 0,
          sets: [createSetDefinition(0, { isMyorep: true })],
        },
      ],
    };
    const session = createWorkoutSession(routine);
    await storage.upsertSession({
      ...session,
      status: 'completed',
      completedAt: '2026-08-10T12:00:00.000Z',
      exercises: [
        {
          ...session.exercises[0],
          sets: [
            createLoggedSet({
              setDefId: 'set-myo',
              order: 0,
              weightKg: 60,
              reps: 15,
              difficulty: 4,
              myorepMiniSets: [{ reps: 4 }, { reps: 3 }],
            }),
          ],
        },
      ],
    });
    render(
      <StorageProvider storage={storage}>
        <HistoryHome />
      </StorageProvider>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Push Day/ }));

    expect(
      screen.getByText(/Set 1 · 60 kg × 15 · difficulty 4 \+ 2 mini-sets/),
    ).toBeInTheDocument();
    expect(screen.getByText('Mini-set 1 · 4 reps')).toBeInTheDocument();
    expect(screen.getByText('Mini-set 2 · 3 reps')).toBeInTheDocument();
  });

  it('shows a skipped-set count when sets were skipped', async () => {
    const storage: StorageService = createLocalStorageAdapter(memoryStorage());
    const routine: Routine = {
      ...createRoutine({ name: 'Push Day' }),
      exercises: [
        {
          id: 'ex-skip',
          exerciseId: 'ex-id-skip',
          name: 'Bench Press',
          order: 0,
          sets: [createSetDefinition(0), createSetDefinition(1)],
        },
      ],
    };
    const session = createWorkoutSession(routine);
    await storage.upsertSession({
      ...session,
      status: 'completed',
      completedAt: '2026-08-10T12:00:00.000Z',
      exercises: [
        {
          ...session.exercises[0],
          skippedSetDefIds: ['skip-1'],
        },
      ],
    });
    render(
      <StorageProvider storage={storage}>
        <HistoryHome />
      </StorageProvider>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Push Day/ }));

    expect(screen.getByText('1 skipped')).toBeInTheDocument();
  });
});
