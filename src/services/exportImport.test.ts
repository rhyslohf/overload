import { vi, describe, it, expect } from 'vitest';
import {
  serializeRoutineExport,
  exportRoutine,
  parseRoutineImport,
  deconflictRoutineName,
  ImportError,
} from './exportImport';
import type { Routine } from '../types/models';
import { SCHEMA_VERSION } from '../types/models';
import { createRoutine } from '../types/factories';

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
