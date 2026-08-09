import { describe, expect, it } from 'vitest';
import { insertAt, moveItem, renumber, removeAt } from '../utils/order';

interface Item {
  id: string;
  order: number;
}

function make(items: string[]): Item[] {
  return items.map((id, order) => ({ id, order }));
}

describe('renumber', () => {
  it('assigns sequential orders 0..n-1', () => {
    const out = renumber(make(['a', 'b', 'c']));
    expect(out.map((i) => i.order)).toEqual([0, 1, 2]);
  });
});

describe('moveItem', () => {
  it('moves an item down and renumbers', () => {
    const out = moveItem(make(['a', 'b', 'c', 'd']), 1, 1);
    expect(out.map((i) => i.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(out.map((i) => i.order)).toEqual([0, 1, 2, 3]);
  });

  it('moves an item up and renumbers', () => {
    const out = moveItem(make(['a', 'b', 'c', 'd']), 2, -1);
    expect(out.map((i) => i.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('stays put at the boundaries', () => {
    expect(moveItem(make(['a', 'b']), 0, -1).map((i) => i.id)).toEqual([
      'a',
      'b',
    ]);
    expect(moveItem(make(['a', 'b']), 1, 1).map((i) => i.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('is a no-op for an out-of-range index', () => {
    expect(moveItem(make(['a', 'b']), 5, 1)).toEqual(make(['a', 'b']));
  });

  it('is immutable', () => {
    const original = make(['a', 'b', 'c']);
    moveItem(original, 0, 1);
    expect(original.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('removeAt', () => {
  it('removes an item and renumbers the rest', () => {
    const out = removeAt(make(['a', 'b', 'c', 'd']), 1);
    expect(out.map((i) => i.id)).toEqual(['a', 'c', 'd']);
    expect(out.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('is a no-op for an out-of-range index', () => {
    expect(removeAt(make(['a']), 3)).toEqual(make(['a']));
  });
});

describe('insertAt', () => {
  it('inserts and renumbers', () => {
    const out = insertAt(make(['a', 'c']), 1, (order) => ({ id: 'b', order }));
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(out.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('clamps the insert index', () => {
    const out = insertAt(make(['a']), 9, (order) => ({ id: 'z', order }));
    expect(out.map((i) => i.id)).toEqual(['a', 'z']);
  });
});
