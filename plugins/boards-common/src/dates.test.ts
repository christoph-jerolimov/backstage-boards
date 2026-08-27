import {
  dueState,
  fridayISO,
  isValidDueDate,
  relativeDueLabel,
  todayISO,
  tomorrowISO,
} from './dates';

describe('isValidDueDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDueDate('2026-08-27')).toBe(true);
    expect(isValidDueDate('2024-02-29')).toBe(true);
  });

  it('rejects malformed or impossible dates', () => {
    expect(isValidDueDate('2026-8-27')).toBe(false);
    expect(isValidDueDate('27.08.2026')).toBe(false);
    expect(isValidDueDate('2026-02-30')).toBe(false);
    expect(isValidDueDate('2026-13-01')).toBe(false);
    expect(isValidDueDate('not a date')).toBe(false);
  });
});

describe('quick date targets', () => {
  // 2026-08-26 is a Wednesday
  const wednesday = new Date(2026, 7, 26, 15, 30);

  it('resolves today and tomorrow', () => {
    expect(todayISO(wednesday)).toBe('2026-08-26');
    expect(tomorrowISO(wednesday)).toBe('2026-08-27');
  });

  it('rolls tomorrow across month ends', () => {
    expect(tomorrowISO(new Date(2026, 7, 31))).toBe('2026-09-01');
  });

  it('resolves the work-week Friday', () => {
    expect(fridayISO(wednesday)).toBe('2026-08-28');
    // Friday stays today
    expect(fridayISO(new Date(2026, 7, 28))).toBe('2026-08-28');
    // Saturday and Sunday roll to next week's Friday
    expect(fridayISO(new Date(2026, 7, 29))).toBe('2026-09-04');
    expect(fridayISO(new Date(2026, 7, 30))).toBe('2026-09-04');
  });
});

describe('dueState', () => {
  const now = new Date(2026, 7, 26, 9, 0);

  it('classifies overdue, today, and upcoming', () => {
    expect(dueState('2026-08-25', now)).toBe('overdue');
    expect(dueState('2026-08-26', now)).toBe('today');
    expect(dueState('2026-08-27', now)).toBe('upcoming');
  });
});

describe('relativeDueLabel', () => {
  const now = new Date(2026, 7, 26);
  it('labels the three days around today', () => {
    expect(relativeDueLabel('2026-08-25', now)).toBe('yesterday');
    expect(relativeDueLabel('2026-08-26', now)).toBe('today');
    expect(relativeDueLabel('2026-08-27', now)).toBe('tomorrow');
    expect(relativeDueLabel('2026-08-28', now)).toBeUndefined();
    expect(relativeDueLabel('2026-08-24', now)).toBeUndefined();
  });
});

describe('defaults to the current date', () => {
  it('resolves today/tomorrow/friday and states without an explicit now', () => {
    const today = todayISO();
    expect(isValidDueDate(today)).toBe(true);
    expect(isValidDueDate(tomorrowISO())).toBe(true);
    expect(isValidDueDate(fridayISO())).toBe(true);
    // the Friday of the current work week is never in the past
    expect(fridayISO() >= today).toBe(true);
    expect(dueState(today)).toBe('today');
    expect(relativeDueLabel(today)).toBe('today');
    expect(relativeDueLabel(tomorrowISO())).toBe('tomorrow');
  });
});
