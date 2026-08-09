import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageProvider } from '../../components/StorageProvider';
import type { StorageService } from '../../services/storage';
import { createLocalStorageAdapter } from '../../services/localStorageAdapter';
import RoutinesHome from './RoutinesHome';
import { memoryStorage } from '../../test/memoryStorage';

function renderRoutines(): StorageService {
  const storage: StorageService = createLocalStorageAdapter(memoryStorage());
  render(
    <StorageProvider storage={storage}>
      <RoutinesHome />
    </StorageProvider>,
  );
  return storage;
}

describe('RoutinesHome — create routine', () => {
  it('shows the empty state plus a New routine action', () => {
    renderRoutines();

    expect(
      screen.getByText('No routines yet — build your first one.'),
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
