/**
 * Ordering helpers for the ordered lists in the model
 * (Routine.exercises, RoutineExercise.sets).
 *
 * `order` is a real, meaningful sequence number (§8) and is also what
 * Phase 6 progression matching keys on — so it must always be sequential
 * and stable. These helpers are immutable: they return new arrays.
 */

type Ordered = { id: string; order: number };

/** Renumber `order` to 0..n-1, tracking the item's position in the array. */
export function renumber<T extends Ordered>(items: readonly T[]): T[] {
  return items.map((item, order) => ({ ...item, order }));
}

/** Move the item at `index` one step up (-1) or down (+1); renumber after. */
export function moveItem<T extends Ordered>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  if (index < 0 || index >= items.length) return [...items];
  const target = index + direction;
  if (target < 0 || target >= items.length) return [...items];
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item);
  return renumber(copy);
}

/** Remove the item at `index`; renumber the rest. */
export function removeAt<T extends Ordered>(
  items: readonly T[],
  index: number,
): T[] {
  if (index < 0 || index >= items.length) return [...items];
  return renumber(items.filter((_, i) => i !== index));
}

/** Insert a crafted item and renumber by comparing it on the inclusive order. */
export function insertAt<T extends Ordered>(
  items: readonly T[],
  index: number,
  makeItem: (order: number) => T,
): T[] {
  const insertIndex = Math.max(0, Math.min(index, items.length));
  const copy = [...items];
  copy.splice(insertIndex, 0, makeItem(insertIndex));
  return renumber(copy);
}
