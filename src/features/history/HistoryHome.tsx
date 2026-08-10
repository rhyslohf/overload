import { useEffect, useState } from 'react';
import { useStorage } from '../../components/StorageProvider';
import type { WorkoutSession } from '../../types/models';
import SessionDetail from './SessionDetail';

type Mode = { kind: 'list' } | { kind: 'detail'; sessionId: string };

const STATUS_LABEL: Record<WorkoutSession['status'], string> = {
  inProgress: 'In progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

/** Finished sessions only (§4.2 lock-into-history); newest first. */
function sortSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions]
    .filter((s) => s.status !== 'inProgress')
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.startedAt).getTime() -
        new Date(a.completedAt ?? a.startedAt).getTime(),
    );
}

function HistoryHome() {
  const storage = useStorage();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void storage.listSessions().then((result) => {
      if (cancelled) return;
      setSessions(sortSessions(result));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  if (mode.kind === 'detail') {
    return (
      <SessionDetail
        sessionId={mode.sessionId}
        onBack={() => setMode({ kind: 'list' })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">History</h1>

      {!loaded ? (
        <p className="text-sm text-ink-2">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-12 text-center">
          <p className="max-w-xs text-sm text-ink-2">
            No logged sessions yet. Finish a workout and it'll land here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() =>
                  setMode({ kind: 'detail', sessionId: session.id })
                }
                className="flex w-full flex-col gap-0.5 rounded-lg border border-line bg-panel px-4 py-3 text-left transition-colors duration-100 hover:bg-raise focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{session.routineName}</span>
                  <span className="text-sm text-ink-3">
                    {STATUS_LABEL[session.status]}
                  </span>
                </span>
                <span className="text-sm text-ink-2">
                  {new Date(
                    session.completedAt ?? session.startedAt,
                  ).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
                <span className="mt-0.5 text-sm text-ink-3">
                  {session.exercises.reduce(
                    (total, exercise) => total + exercise.sets.length,
                    0,
                  )}{' '}
                  {session.exercises.reduce(
                    (total, exercise) => total + exercise.sets.length,
                    0,
                  ) === 1
                    ? 'set'
                    : 'sets'}{' '}
                  logged
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HistoryHome;
