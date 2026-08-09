import { useEffect, useRef, useState } from 'react';
import Button from '../../components/Button';
import { useStorage } from '../../components/StorageProvider';
import type { Routine } from '../../types/models';
import { createWorkoutSession } from '../../types/factories';
import WorkoutSessionView from '../workout/WorkoutSessionView';
import RoutineDetail from './RoutineDetail';
import RoutineEditor from './RoutineEditor';

type Mode =
  | { kind: 'list' }
  | { kind: 'editor'; routine: Routine | null }
  | { kind: 'detail'; routineId: string }
  | { kind: 'workout'; sessionId: string };

function RoutinesHome() {
  const storage = useStorage();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [savedName, setSavedName] = useState<string | null>(null);
  const savedTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void storage.listRoutines().then((result) => {
      if (cancelled) return;
      setRoutines(result);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  function openEditor(routine: Routine | null) {
    setMode({ kind: 'editor', routine });
  }

  async function handleSave(routine: Routine) {
    await storage.upsertRoutine(routine);
    setSavedName(routine.name);
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedName(null), 2500);
    const updated = await storage.listRoutines();
    setRoutines(updated);
    setMode({ kind: 'list' });
  }

  async function handleDelete(id: string) {
    await storage.deleteRoutine(id);
    const updated = await storage.listRoutines();
    setRoutines(updated);
    setMode({ kind: 'list' });
  }

  async function handleStartWorkout(routine: Routine) {
    const session = createWorkoutSession(routine);
    await storage.upsertSession(session);
    setMode({ kind: 'workout', sessionId: session.id });
  }

  if (mode.kind === 'editor') {
    return (
      <RoutineEditor
        initialRoutine={mode.routine}
        onSave={(routine) => {
          void handleSave(routine);
        }}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }

  if (mode.kind === 'detail') {
    return (
      <RoutineDetail
        routineId={mode.routineId}
        onBack={() => setMode({ kind: 'list' })}
        onEdit={openEditor}
        onDelete={(id) => {
          void handleDelete(id);
        }}
        onStart={(routine) => {
          void handleStartWorkout(routine);
        }}
      />
    );
  }

  if (mode.kind === 'workout') {
    return (
      <WorkoutSessionView
        sessionId={mode.sessionId}
        onBack={() => setMode({ kind: 'list' })}
        onFinish={() => setMode({ kind: 'list' })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Routines</h1>
        <Button variant="primary" onClick={() => openEditor(null)}>
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

      {!loaded ? (
        <p className="text-sm text-ink-2">Loading…</p>
      ) : routines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-8 text-center">
          <p className="max-w-xs text-sm text-ink-2">
            No routines yet — build your first one.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {routines.map((routine) => (
            <li key={routine.id}>
              <button
                type="button"
                onClick={() =>
                  setMode({ kind: 'detail', routineId: routine.id })
                }
                className="flex w-full flex-col gap-0.5 rounded-lg border border-line bg-panel px-4 py-3 text-left transition-colors duration-100 hover:bg-raise focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <span className="font-semibold">{routine.name}</span>
                {routine.description && (
                  <span className="text-sm text-ink-2">
                    {routine.description}
                  </span>
                )}
                <span className="mt-0.5 text-sm text-ink-3">
                  {routine.exercises.length}{' '}
                  {routine.exercises.length === 1 ? 'exercise' : 'exercises'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RoutinesHome;
