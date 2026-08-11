/**
 * Format a long number as a short human-readable string: 1200 -> "1.2K",
 * 3_500_000 -> "3.5M". Used for unread badges and room member counts.
 *
 * This replaces the `millify` package with a direct port of its algorithm.
 * It is a port rather than a rewrite on purpose: switching to
 * `Intl.NumberFormat`'s `notation: 'compact'` would have been shorter, but it
 * localises the *unit* as well as the number ("1,2 Tsd." rather than "1.2K"),
 * which would silently change what every badge in the app renders under a
 * non-English locale. The number itself is still localised here, exactly as
 * before, because the final `toLocaleString` is kept.
 */

export interface MillifyOptions {
  /** Number of decimal places to round to. */
  precision: number;
  /** BCP 47 locale(s) for formatting the numeric part. */
  locales?: string | string[];
  /** Render the unit suffix in lower case. */
  lowercase: boolean;
  /** Put a space between the number and its unit. */
  space: boolean;
  /** Unit suffixes, ascending by factor of 1000. */
  units: string[];
}

const DIGIT_GROUPING_BASE = 1000;

const defaultOptions: MillifyOptions = {
  lowercase: false,
  precision: 1,
  space: false,
  units: ['', 'K', 'M', 'B', 'T', 'P', 'E'],
};

/**
 * Divide by the grouping base until the result drops below 1, yielding each
 * intermediate. The number of yields is the index of the unit suffix.
 */
function* divider(value: number): Generator<number> {
  let denominator = DIGIT_GROUPING_BASE;
  for (;;) {
    const result = value / denominator;
    if (result < 1) return;
    yield result;
    denominator *= DIGIT_GROUPING_BASE;
  }
}

const roundTo = (value: number, precision: number): number =>
  Number.isInteger(value) ? value : parseFloat(value.toFixed(precision));

/** Digits after the decimal point, so `toLocaleString` keeps them. */
const getFractionDigits = (num: number): number => {
  if (Number.isInteger(num)) return 0;
  return num.toString().split('.')[1]?.length ?? 0;
};

export const millify = (count: number, options?: Partial<MillifyOptions>): string => {
  const opts: MillifyOptions = options ? { ...defaultOptions, ...options } : defaultOptions;

  // Anything not a finite number in safe-integer range has no meaningful
  // abbreviation, so it is returned as-is rather than guessed at.
  const parsed = parseFloat(String(count));
  if (
    !Number.isFinite(parsed) ||
    parsed > Number.MAX_SAFE_INTEGER ||
    parsed < Number.MIN_SAFE_INTEGER
  ) {
    return String(count);
  }

  const prefix = parsed < 0 ? '-' : '';
  let value = Math.abs(parsed);

  let unitIndex = 0;
  for (const result of divider(value)) {
    value = result;
    unitIndex += 1;
  }

  // Too large for any unit we have; abbreviating further would be ambiguous.
  if (unitIndex >= opts.units.length) return String(count);

  let rounded = roundTo(value, opts.precision);

  // Rounding can push the value back over the base — without this pass, 999_999
  // formats as "1000K" instead of "1M".
  for (const result of divider(rounded)) {
    rounded = result;
    unitIndex += 1;
  }

  const unit = opts.units[unitIndex] ?? '';
  const suffix = opts.lowercase ? unit.toLowerCase() : unit;
  const space = opts.space ? ' ' : '';

  const formatted = rounded.toLocaleString(opts.locales ?? [], {
    minimumFractionDigits: getFractionDigits(rounded),
  });

  return `${prefix}${formatted}${space}${suffix}`;
};

export default millify;
