import { useState } from 'react';
import AppShell from './components/AppShell';
import type { View } from './components/BottomNav';
import { StorageProvider } from './components/StorageProvider';
import HistoryHome from './features/history/HistoryHome';
import RoutinesHome from './features/routines/RoutinesHome';
import { createLocalStorageAdapter } from './services/localStorageAdapter';

const storage = createLocalStorageAdapter();

function App() {
  const [view, setView] = useState<View>('routines');

  return (
    <StorageProvider storage={storage}>
      <AppShell view={view} onViewChange={setView}>
        {view === 'routines' ? <RoutinesHome /> : <HistoryHome />}
      </AppShell>
    </StorageProvider>
  );
}

export default App;
