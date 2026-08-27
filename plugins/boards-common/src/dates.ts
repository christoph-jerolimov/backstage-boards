/**
 * Due-date helpers. Due dates are plain calendar dates (`YYYY-MM-DD`)
 * without a time component, interpreted in the viewer's local timezone.
 */

const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Strict `YYYY-MM-DD` check that also rejects impossible dates. */
export function isValidDueDate(value: string): boolean {
  if (!DUE_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today as a local `YYYY-MM-DD` date. */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Tomorrow as a local `YYYY-MM-DD` date. */
export function tomorrowISO(now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  return toISODate(date);
}

/**
 * The Friday of the current work week: today when today is Friday, the
 * upcoming Friday Monday–Thursday, and next week's Friday on weekends.
 */
export function fridayISO(now: Date = new Date()): string {
  const date = new Date(now);
  const day = date.getDay(); // 0 = Sunday ... 6 = Saturday
  const daysUntilFriday = (5 - day + 7) % 7;
  date.setDate(date.getDate() + daysUntilFriday);
  return toISODate(date);
}

export type DueState = 'overdue' | 'today' | 'upcoming';

/**
 * Classifies a due date against local today. Plain string comparison is
 * correct because both sides are `YYYY-MM-DD`.
 */
export function dueState(dueDate: string, now: Date = new Date()): DueState {
  const today = todayISO(now);
  if (dueDate < today) {
    return 'overdue';
  }
  if (dueDate === today) {
    return 'today';
  }
  return 'upcoming';
}
