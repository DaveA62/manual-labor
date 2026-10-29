export const money = (value: number) => '$' + value.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
export const serial = (number: number) => String(number).padStart(2, '0');
