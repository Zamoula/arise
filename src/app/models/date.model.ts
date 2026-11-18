/**
 * Small date helpers shared by habit history and the statistics model.
 * Everything works in local time so a "day" matches the user's calendar.
 */

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Formats a date as `YYYY-MM-DD` in local time. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` string back into a local date. */
export function parseIsoDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  const offset = (start.getDay() + 6) % 7; // Monday = 0
  return addDays(start, -offset);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function compareDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

export function minDate(a: Date, b: Date): Date {
  return compareDates(a, b) <= 0 ? a : b;
}

export function maxDate(a: Date, b: Date): Date {
  return compareDates(a, b) >= 0 ? a : b;
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return compareDates(date, start) >= 0 && compareDates(date, end) <= 0;
}

/** Every day from `start` to `end`, both inclusive. */
export function daysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let day = startOfDay(start); compareDates(day, end) <= 0; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}
