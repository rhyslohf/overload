import type { Routine, WorkoutSession } from '../types/models';
import { SCHEMA_VERSION } from '../types/models';

/** Thrown when an uploaded file can't be parsed as a valid routine export. */
export class ImportError extends Error {}

/**
 * Routine export payload (REQUIREMENTS.md §6 `routine-export.json`).
 * The routine is snapshotted as-is so a round-trip import reproduces it
 * exactly.
 */
export interface RoutineExport {
  schemaVersion: number;
  exportedAt: string;
  routine: Routine;
}

/**
 * History export payload (REQUIREMENTS.md §6 `history-export.json`).
 * Every finished session in one file for backup / portability.
 */
export interface HistoryExport {
  schemaVersion: number;
  exportedAt: string;
  sessions: WorkoutSession[];
}

/** Trigger a browser download of `json` as `filename`. */
function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Build the routine-export.json payload. */
export function serializeRoutineExport(routine: Routine): RoutineExport {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    routine,
  };
}

/**
 * Serialize a routine to the routine-export.json shape and trigger a
 * browser download. The serialization is split out (see
 * `serializeRoutineExport`) so it can be unit-tested without the DOM.
 */
export function exportRoutine(routine: Routine): void {
  const payload = serializeRoutineExport(routine);
  downloadJson(
    `${routine.name}-routine.json`,
    JSON.stringify(payload, null, 2),
  );
}

/** Build the history-export.json payload (all sessions). */
export function serializeHistoryExport(
  sessions: WorkoutSession[],
): HistoryExport {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sessions,
  };
}

/** Serialize every session to history-export.json and download it. */
export function exportHistory(sessions: WorkoutSession[]): void {
  const payload = serializeHistoryExport(sessions);
  downloadJson('history-export.json', JSON.stringify(payload, null, 2));
}

/** True when `value` is a non-empty string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate and parse a routine-export.json payload (REQUIREMENTS.md §4.5,
 * `routine-export.json`). Accepts either the wrapped shape
 * `{ schemaVersion, exportedAt, routine }` or a bare `Routine`. Throws
 * `ImportError` on anything that isn't a recognizable routine.
 *
 * The check is intentionally structural rather than field-perfect: it only
 * insists on the fields the app actually needs to render and run a session
 * (a name, an exercises array whose entries have names and a sets array),
 * so a routine exported by an older schema version still imports instead of
 * being rejected — the migration stub (Phase 5 item 6) handles drift.
 */
export function parseRoutineImport(json: string): Routine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportError('File is not valid JSON.');
  }

  const candidate =
    parsed && typeof parsed === 'object' && 'routine' in parsed
      ? parsed.routine
      : parsed;

  if (candidate == null || typeof candidate !== 'object') {
    throw new ImportError('File is not a routine export.');
  }

  const routine = candidate as Record<string, unknown>;

  if (!isNonEmptyString(routine.name)) {
    throw new ImportError('Routine is missing a name.');
  }

  if (!Array.isArray(routine.exercises)) {
    throw new ImportError('Routine is missing its exercises.');
  }

  for (const exercise of routine.exercises) {
    if (exercise == null || typeof exercise !== 'object') {
      throw new ImportError('Routine has a malformed exercise.');
    }
    const ex = exercise as Record<string, unknown>;
    if (!isNonEmptyString(ex.name)) {
      throw new ImportError('An exercise is missing its name.');
    }
    if (!Array.isArray(ex.sets)) {
      throw new ImportError('An exercise is missing its sets.');
    }
  }

  return routine as unknown as Routine;
}

/**
 * Resolve a name collision for an imported routine (§4.5 "import as copy").
 * If `existingNames` already contains the routine's name, appends
 * " (copy)" / " (copy 2)" / … until it's unique. Pure so it's unit-testable.
 */
export function deconflictRoutineName(
  routine: Routine,
  existingNames: readonly string[],
): Routine {
  const taken = new Set(existingNames.map((name) => name.trim()));
  const name = routine.name.trim();
  if (!taken.has(name)) return routine;

  const base = `${name} (copy`;
  if (!taken.has(`${base})`)) return { ...routine, name: `${base})` };

  let n = 2;
  while (taken.has(`${base} ${n})`)) n += 1;
  return { ...routine, name: `${base} ${n})` };
}
