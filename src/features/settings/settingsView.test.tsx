import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '../../components/SettingsProvider';
import { StorageProvider } from '../../components/StorageProvider';
import { createLocalStorageAdapter } from '../../services/localStorageAdapter';
import type { StorageService } from '../../services/storage';
import { memoryStorage } from '../../test/memoryStorage';
import SettingsView from './SettingsView';

function renderSettings(): StorageService {
  const storage: StorageService = createLocalStorageAdapter(memoryStorage());
  render(
    <StorageProvider storage={storage}>
      <SettingsProvider>
        <SettingsView />
      </SettingsProvider>
    </StorageProvider>,
  );
  return storage;
}

describe('SettingsView — rounding increment', () => {
  it('shows the options with 2.5 kg selected by default', async () => {
    renderSettings();

    expect(
      await screen.findByRole('button', { name: '2.5 kg' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '5 kg' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('persists a selected increment to storage', async () => {
    const user = userEvent.setup();
    const storage = renderSettings();

    await user.click(await screen.findByRole('button', { name: '5 kg' }));

    expect(screen.getByRole('button', { name: '5 kg' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(async () => {
      const settings = await storage.getSettings();
      expect(settings.roundingIncrement).toBe(5);
    });
  });
});
