/**
 * Weight math helpers.
 *
 * Rounding increment comes from §9.1 — suggested and percentage weights land
 * on real plates, not arbitrary decimals. The value is a named constant here
 * so a future settings screen can swap it without touching feature code
 * (§7: thresholds are constants, not magic numbers). Units are canonical kg.
 */

/** Rounding increment for suggested/percentage weights: default 2.5 kg (§9.1). */
export const ROUNDING_INCREMENT = 2.5;

/** Round a computed weight down to the nearest plate increment. */
export function roundToIncrement(
  value: number,
  increment: number = ROUNDING_INCREMENT,
): number {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}