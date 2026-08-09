import { render, screen, waitFor } from '@testing-library/react';
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

  it('shows the planned sets for each snapshotted exercise', async () => {
    const user = userEvent.setup();
    const storage = createLocalStorageAdapter(memoryStorage());
    await storage.upsertRoutine(routineWithSets('Push Day'));
    renderWithStorage(storage);

    await user.click(await screen.findByRole('button', { name: /Push Day/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Start workout' }),
    );

    expect(await screen.findByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('1. 10 × 100 kg')).toBeInTheDocument();
    expect(screen.getByText('2. 8 × 90 kg')).toBeInTheDocument();
    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();
    expect(screen.getByText('1. 12 × 60 kg')).toBeInTheDocument();
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
});
