import { useEffect, useRef, useState } from 'react';
import Button from '../../components/Button';
import { useStorage } from '../../components/StorageProvider';
import type { Routine } from '../../types/models';
import RoutineEditor from './RoutineEditor';

type Mode = { kind: 'list' } | { kind: 'editor'; routineId: string | null };

function RoutinesHome() {
  const storage = useStorage();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  const [savedName, setSavedName] = useState<string | null>(null);
  const savedTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    },
    [],
  );

  async function handleSave(routine: Routine) {
    await storage.upsertRoutine(routine);
    setSavedName(routine.name);
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedName(null), 2500);
    setMode({ kind: 'list' });
  }

  if (mode.kind === 'editor') {
    return (
      <RoutineEditor
        onSave={(routine) => {
          void handleSave(routine);
        }}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Routines</h1>
        <Button
          variant="primary"
          onClick={() => setMode({ kind: 'editor', routineId: null })}
        >
          New routine
        </Button>
      </div>

      {savedName && (
        <p
          role="status"
          className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-hi"
        >
          Routine “{savedName}” saved.
        </p>
      )}

      <div className="flex flex-col items-center gap-3 pt-8 text-center">
        <p className="max-w-xs text-sm text-ink-2">
          No routines yet — build your first one.
        </p>
      </div>
    </div>
  );
}

export default RoutinesHome;
