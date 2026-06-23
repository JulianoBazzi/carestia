/** Converts a decimal amount (string or number) to integer cents. */
export const toCents = (value: string | number): number => Math.round(Number(value) * 100);

/** Converts integer cents back to a decimal amount. */
export const fromCents = (cents: number): number => cents / 100;
