import type { Routine } from '../types/models';
import { SCHEMA_VERSION } from '../types/models';

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
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${routine.name}-routine.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
