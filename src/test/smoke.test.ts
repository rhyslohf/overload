import { describe, expect, it } from 'vitest';

function add(a: number, b: number) {
  return a + b;
}

describe('smoke', () => {
  it('runs the test pipeline', () => {
    expect(add(1, 2)).toBe(3);
  });
});