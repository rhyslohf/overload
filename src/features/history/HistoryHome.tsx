import { useEffect, useRef, useState } from 'react';
import Button from '../../components/Button';
import LoadError from '../../components/LoadError';
import { useStorage } from '../../components/StorageProvider';
import type { WorkoutSession } from '../../types/models';
import {
  exportHistory,
  importHistory,
  ImportError,
  parseHistoryImport,
  type HistoryImportMode,
} from '../../services/exportImport';
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
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Sessions parsed from a picked file, awaiting a merge/replace choice.
  const [pendingImport, setPendingImport] = useState<WorkoutSession[] | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void storage
      .listSessions()
      .then((result) => {
        if (cancelled) return;
        setSessions(sortSessions(result));
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storage, reloadKey]);

  async function applyImport(
    incoming: WorkoutSession[],
    importMode: HistoryImportMode,
  ) {
    const existing = await storage.listSessions();
    const next = importHistory(existing, incoming, importMode);
    const nextIds = new Set(next.map((s) => s.id));
    // Replace drops sessions that aren't in the incoming set.
    for (const session of existing) {
      if (!nextIds.has(session.id)) await storage.deleteSession(session.id);
    }
    for (const session of next) {
      await storage.upsertSession(session);
    }
    setSessions(sortSessions(next));
    setPendingImport(null);
  }

  function onImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file == null) return;
    void (async () => {
      try {
        const text = await file.text();
        setPendingImport(parseHistoryImport(text));
      } catch (error) {
        setPendingImport(null);
        window.alert(
          error instanceof ImportError
            ? error.message
            : 'Could not import that file.',
        );
      }
    })();
  }

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">History</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </Button>
          {sessions.length > 0 && (
            <Button variant="secondary" onClick={() => exportHistory(sessions)}>
              Export all
            </Button>
          )}
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Import history"
        className="pointer-events-none absolute h-px w-px opacity-0"
        onChange={onImportFile}
      />

      {pendingImport && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
          <p className="text-sm text-ink-2">
            Import {pendingImport.length}{' '}
            {pendingImport.length === 1 ? 'session' : 'sessions'}?
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => void applyImport(pendingImport, 'merge')}
            >
              Merge
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => void applyImport(pendingImport, 'replace')}
            >
              Replace
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setPendingImport(null)}
            className="inline-flex min-h-11 items-center justify-center self-center text-sm text-ink-2 transition-colors duration-100 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-ink-2">Loading…</p>
      ) : loadError ? (
        <LoadError
          message="Couldn't load your history."
          onRetry={() => {
            setLoadError(false);
            setLoaded(false);
            setReloadKey((key) => key + 1);
          }}
        />
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
