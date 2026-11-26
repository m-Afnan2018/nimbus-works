export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatPeriodName(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function parsePeriod(rawMonth: unknown, rawYear: unknown): { month: number; year: number } | null {
  const month = Number(rawMonth);
  const year = Number(rawYear);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) return null;
  return { month, year };
}
