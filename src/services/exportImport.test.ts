import { vi, describe, it, expect } from 'vitest';
import { serializeRoutineExport, exportRoutine } from './exportImport';
import { SCHEMA_VERSION } from '../types/models';
import { createRoutine } from '../types/factories';

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
