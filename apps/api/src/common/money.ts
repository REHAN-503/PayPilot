type MoneyValue = number | string | { toString(): string };

/** Convert decimal currency to integer cents without floating point arithmetic. */
export function toCents(value: MoneyValue): number {
  const amount = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new Error(`Invalid monetary amount: ${amount}`);
  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return sign ? -cents : cents;
}

export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) throw new Error('Currency cents must be a safe integer');
  return cents / 100;
}

export function sumCents(...values: MoneyValue[]): number {
  return values.reduce<number>((sum, value) => sum + toCents(value), 0);
}
