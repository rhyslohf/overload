import { useState } from 'react';
import AppShell from './components/AppShell';
import type { View } from './components/BottomNav';
import { SettingsProvider } from './components/SettingsProvider';
import { StorageProvider } from './components/StorageProvider';
import HistoryHome from './features/history/HistoryHome';
import RoutinesHome from './features/routines/RoutinesHome';
import SettingsView from './features/settings/SettingsView';
import { createLocalStorageAdapter } from './services/localStorageAdapter';

const storage = createLocalStorageAdapter();

function App() {
  const [view, setView] = useState<View>('routines');

  return (
    <StorageProvider storage={storage}>
      <SettingsProvider>
        <AppShell view={view} onViewChange={setView}>
          {view === 'routines' ? (
            <RoutinesHome />
          ) : view === 'history' ? (
            <HistoryHome />
          ) : (
            <SettingsView />
          )}
        </AppShell>
      </SettingsProvider>
    </StorageProvider>
  );
}

export default App;
