export const money = (value: number) => '$' + value.toLocaleString('en-US');
export const serial = (number: number) => String(number).padStart(2, '0');
