import { vi, describe, it, expect } from 'vitest';
import {
  serializeRoutineExport,
  exportRoutine,
  parseRoutineImport,
  deconflictRoutineName,
  ImportError,
  serializeHistoryExport,
  exportHistory,
  parseHistoryImport,
  importHistory,
} from './exportImport';
import type { Routine, WorkoutSession } from '../types/models';
import { SCHEMA_VERSION } from '../types/models';
import { createRoutine, createWorkoutSession } from '../types/factories';

function routineExportJson(routine: Routine): string {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    routine,
  });
}

describe('serializeRoutineExport', () => {
  it('wraps a routine in the routine-export.json shape', () => {
    const routine = createRoutine({ name: 'Push Day' });
    const payload = serializeRoutineExport(routine);

    expect(payload.schemaVersion).toBe(SCHEMA_VERSION);
    expect(typeof payload.exportedAt).toBe('string');
    // exportedAt is a valid ISO timestamp.
    expect(Number.isNaN(Date.parse(payload.exportedAt))).toBe(false);
    expect(payload.routine).toBe(routine);
  });
});

describe('exportRoutine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes the routine and triggers a download via an anchor click', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const routine = createRoutine({ name: 'Push Day' });
    exportRoutine(routine);

    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Push Day-routine.json');
    expect(anchor.href).toBe('blob:mock');
  });
});

describe('serializeHistoryExport', () => {
  it('wraps all sessions in the history-export.json shape', () => {
    const sessions = [
      createWorkoutSession(createRoutine({ name: 'Push Day' })),
    ];
    const payload = serializeHistoryExport(sessions);

    expect(payload.schemaVersion).toBe(SCHEMA_VERSION);
    expect(typeof payload.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(payload.exportedAt))).toBe(false);
    expect(payload.sessions).toBe(sessions);
  });
});

describe('exportHistory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes the sessions and triggers a download', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const sessions = [
      createWorkoutSession(createRoutine({ name: 'Push Day' })),
    ];
    exportHistory(sessions);

    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('history-export.json');
    expect(anchor.href).toBe('blob:mock');
  });
});

describe('parseHistoryImport', () => {
  function historyExportJson(sessions: WorkoutSession[]): string {
    return JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      sessions,
    });
  }

  it('parses a wrapped history-export.json payload', () => {
    const sessions = [
      createWorkoutSession(createRoutine({ name: 'Push Day' })),
    ];
    const parsed = parseHistoryImport(historyExportJson(sessions));

    expect(parsed).toEqual(sessions);
  });

  it('accepts a bare sessions array', () => {
    const sessions = [createWorkoutSession(createRoutine({ name: 'Leg Day' }))];
    const parsed = parseHistoryImport(JSON.stringify(sessions));

    expect(parsed).toEqual(sessions);
  });

  it('throws ImportError on invalid JSON', () => {
    expect(() => parseHistoryImport('{ not json')).toThrow(ImportError);
  });

  it('throws ImportError when the payload is not a history export', () => {
    expect(() => parseHistoryImport(JSON.stringify({ foo: 'bar' }))).toThrow(
      ImportError,
    );
  });

  it('throws ImportError when a session is missing its routine name', () => {
    const session = createWorkoutSession(createRoutine({ name: 'Push Day' }));
    delete (session as { routineName?: string }).routineName;

    expect(() => parseHistoryImport(historyExportJson([session]))).toThrow(
      /routine name/i,
    );
  });
});

describe('importHistory', () => {
  it('replaces existing sessions with the incoming set', () => {
    const existing = [
      createWorkoutSession(createRoutine({ name: 'Push Day' })),
    ];
    const incoming = [createWorkoutSession(createRoutine({ name: 'Leg Day' }))];
    const result = importHistory(existing, incoming, 'replace');

    expect(result).toEqual(incoming);
  });

  it('merges sessions and de-duplicates by id (incoming wins)', () => {
    const shared = createWorkoutSession(createRoutine({ name: 'Push Day' }));
    const existing = [shared];
    const incoming = [{ ...shared, routineName: 'Renamed' }];
    const other = createWorkoutSession(createRoutine({ name: 'Leg Day' }));
    incoming.push(other);

    const result = importHistory(existing, incoming, 'merge');

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.id === shared.id)?.routineName).toBe('Renamed');
    expect(result.find((s) => s.id === other.id)).toBe(other);
  });
});

describe('parseRoutineImport', () => {
  it('parses a wrapped routine-export.json payload', () => {
    const routine = createRoutine({ name: 'Push Day' });
    const parsed = parseRoutineImport(routineExportJson(routine));

    expect(parsed).toEqual(routine);
  });

  it('accepts a bare routine object', () => {
    const routine = createRoutine({ name: 'Leg Day' });
    const parsed = parseRoutineImport(JSON.stringify(routine));

    expect(parsed).toEqual(routine);
  });

  it('throws ImportError on invalid JSON', () => {
    expect(() => parseRoutineImport('{ not json')).toThrow(ImportError);
  });

  it('throws ImportError when the name is missing', () => {
    const routine = createRoutine({ name: 'Push Day' });
    delete (routine as { name?: string }).name;

    expect(() => parseRoutineImport(routineExportJson(routine))).toThrow(
      /name/i,
    );
  });

  it('throws ImportError when exercises is not an array', () => {
    const routine = {
      ...createRoutine({ name: 'Push Day' }),
      exercises: 'nope',
    };

    expect(() => parseRoutineImport(JSON.stringify(routine))).toThrow(
      /exercises/i,
    );
  });

  it('throws ImportError when an exercise is missing its name', () => {
    const routine = createRoutine({ name: 'Push Day' });
    (routine.exercises as unknown[]).push({ sets: [] });

    expect(() => parseRoutineImport(routineExportJson(routine))).toThrow(
      /name/i,
    );
  });
});

describe('deconflictRoutineName', () => {
  it('leaves the name untouched when there is no collision', () => {
    const routine = createRoutine({ name: 'Push Day' });
    const result = deconflictRoutineName(routine, ['Leg Day']);

    expect(result).toBe(routine);
    expect(result.name).toBe('Push Day');
  });

  it('appends " (copy)" on a collision', () => {
    const routine = createRoutine({ name: 'Push Day' });
    const result = deconflictRoutineName(routine, ['Push Day']);

    expect(result.name).toBe('Push Day (copy)');
  });

  it('appends " (copy 2)" when the copy name is also taken', () => {
    const routine = createRoutine({ name: 'Push Day' });
    const result = deconflictRoutineName(routine, [
      'Push Day',
      'Push Day (copy)',
    ]);

    expect(result.name).toBe('Push Day (copy 2)');
  });
});
