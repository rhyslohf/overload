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

/** A raw export payload — migration steps are version-aware but shape-agnostic. */
interface ExportPayload {
  schemaVersion?: unknown;
  [key: string]: unknown;
}

/** A migration step upgrades an export payload from version N to N+1. */
type MigrationStep = (payload: ExportPayload) => ExportPayload;

/**
 * Step-up migrations keyed by the schema version they upgrade FROM
 * (REQUIREMENTS.md §4.5: exports carry `schemaVersion` so a future app
 * version can migrate an older export instead of rejecting it). Empty today
 * because v1 is the only released schema; a future v2 would add
 * `routineMigrations[1] = (p) => ({ ...p, someNewField: p.someOldField })`.
 */
const routineMigrations: Record<number, MigrationStep> = {};
const historyMigrations: Record<number, MigrationStep> = {};

/**
 * Bring `payload` up to the current SCHEMA_VERSION, applying one migration
 * step per version gap. Throws `ImportError` for a payload newer than this
 * app understands, or when no migration path exists for an old version.
 */
function migrateExport(
  payload: ExportPayload,
  steps: Record<number, MigrationStep>,
  label: string,
): ExportPayload {
  const rawVersion = payload.schemaVersion;
  const from =
    rawVersion === undefined
      ? 1
      : typeof rawVersion === 'number'
        ? rawVersion
        : NaN;

  if (!Number.isInteger(from) || from < 1) {
    throw new ImportError(`${label} has an unrecognized schemaVersion.`);
  }
  if (from > SCHEMA_VERSION) {
    throw new ImportError(
      `${label} is from a newer app version (schema ${from}) and can't be imported yet.`,
    );
  }

  let current = payload;
  for (let version = from; version < SCHEMA_VERSION; version += 1) {
    const step = steps[version];
    if (!step) {
      throw new ImportError(
        `No migration path exists from ${label} schema ${version}.`,
      );
    }
    current = step(current);
  }
  return { ...current, schemaVersion: SCHEMA_VERSION };
}

/** True when `value` is a non-null object (not an array). */
function isRecord(value: unknown): value is ExportPayload {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Migrate a routine-export payload to the current schema version. */
export function migrateRoutineExport(payload: unknown): RoutineExport {
  if (!isRecord(payload)) {
    throw new ImportError('File is not a routine export.');
  }
  const migrated = migrateExport(payload, routineMigrations, 'routine export');
  if (!('routine' in migrated)) {
    throw new ImportError('File is not a routine export.');
  }
  return migrated as unknown as RoutineExport;
}

/** Migrate a history-export payload to the current schema version. */
export function migrateHistoryExport(payload: unknown): HistoryExport {
  if (!isRecord(payload)) {
    throw new ImportError('File is not a workout-history export.');
  }
  const migrated = migrateExport(payload, historyMigrations, 'history export');
  if (!Array.isArray(migrated.sessions)) {
    throw new ImportError('File is not a workout-history export.');
  }
  return migrated as unknown as HistoryExport;
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

/** How an imported history combines with what's already stored. */
export type HistoryImportMode = 'merge' | 'replace';

/**
 * Validate and parse a history-export.json payload (REQUIREMENTS.md §4.5,
 * `history-export.json`). Accepts either the wrapped shape or a bare
 * `WorkoutSession[]`. Returns the sessions. Throws `ImportError` on anything
 * that isn't a recognizable history export. Structural so an older-schema
 * export still imports; a wrapped payload is first migrated to the current
 * schema version.
 */
export function parseHistoryImport(json: string): WorkoutSession[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportError('File is not valid JSON.');
  }

  const rawSessions = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && 'sessions' in parsed
      ? migrateHistoryExport(parsed).sessions
      : null;

  if (rawSessions == null) {
    throw new ImportError('File is not a workout-history export.');
  }

  for (const session of rawSessions) {
    if (session == null || typeof session !== 'object') {
      throw new ImportError('History has a malformed session.');
    }
    const s = session as Record<string, unknown>;
    if (!isNonEmptyString(s.routineName)) {
      throw new ImportError('A session is missing its routine name.');
    }
    if (!isNonEmptyString(s.startedAt)) {
      throw new ImportError('A session is missing its start time.');
    }
    if (!Array.isArray(s.exercises)) {
      throw new ImportError('A session is missing its exercises.');
    }
  }

  return rawSessions as WorkoutSession[];
}

/**
 * Combine existing sessions with an imported set (§4.5). In `merge` mode
 * the two are unioned with the imported session winning on an id collision;
 * in `replace` mode the imported set fully overwrites. Pure so it's
 * unit-testable.
 */
export function importHistory(
  existing: WorkoutSession[],
  incoming: WorkoutSession[],
  mode: HistoryImportMode,
): WorkoutSession[] {
  if (mode === 'replace') return incoming;

  const byId = new Map<string, WorkoutSession>();
  for (const session of existing) {
    byId.set(session.id, session);
  }
  for (const session of incoming) {
    byId.set(session.id, session);
  }
  return [...byId.values()];
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
 * so a routine exported by an older schema version still imports. A wrapped
 * payload is first migrated to the current schema version.
 */
export function parseRoutineImport(json: string): Routine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportError('File is not valid JSON.');
  }

  const candidate =
    isRecord(parsed) && 'routine' in parsed
      ? migrateRoutineExport(parsed).routine
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
