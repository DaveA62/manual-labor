export const money = (value: number) => '$' + value.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
export const serial = (number: number) => String(number).padStart(2, '0');

/** HUD only; the full dollar balance remains available to assistive technology. */
export const compactMoney = (value: number) => value < 10000 ? money(value) : '$' + value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
