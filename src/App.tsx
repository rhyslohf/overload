import { useState } from 'react';
import AppShell from './components/AppShell';
import type { View } from './components/BottomNav';
import HistoryHome from './features/history/HistoryHome';
import RoutinesHome from './features/routines/RoutinesHome';

function App() {
  const [view, setView] = useState<View>('routines');

  return (
    <AppShell view={view} onViewChange={setView}>
      {view === 'routines' ? <RoutinesHome /> : <HistoryHome />}
    </AppShell>
  );
}

export default App;
