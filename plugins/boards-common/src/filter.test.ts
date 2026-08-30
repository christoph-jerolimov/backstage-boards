import { todayISO } from './dates';
import { isEmptyFilter, itemMatchesFilter, normalizeTags } from './filter';
import { BoardItem } from './types';

const item: BoardItem = {
  id: '1',
  boardId: 'b',
  columnId: 'c',
  position: 0,
  title: 'Fix Login bug',
  description: 'SSO users are affected',
  descriptionVersionCount: 1,
  createdBy: 'user:default/alice',
  createdAt: '2026-01-01T00:00:00Z',
  updatedBy: 'user:default/alice',
  updatedAt: '2026-01-01T00:00:00Z',
  assignees: [],
  tags: ['bug', 'urgent'],
  checklist: [],
};

describe('itemMatchesFilter', () => {
  it('matches everything on an empty filter', () => {
    expect(itemMatchesFilter(item, {})).toBe(true);
    expect(isEmptyFilter({})).toBe(true);
    expect(isEmptyFilter({ text: '  ' })).toBe(true);
    expect(isEmptyFilter({ tags: ['x'] })).toBe(false);
    expect(isEmptyFilter({ assignees: [] })).toBe(true);
    expect(isEmptyFilter({ assignees: ['user:default/bob'] })).toBe(false);
    expect(isEmptyFilter({ priorities: [] })).toBe(true);
    expect(isEmptyFilter({ priorities: ['p1'] })).toBe(false);
  });

  it('searches title and description case-insensitively', () => {
    expect(itemMatchesFilter(item, { text: 'login' })).toBe(true);
    expect(itemMatchesFilter(item, { text: 'sso USERS' })).toBe(true);
    expect(itemMatchesFilter(item, { text: 'nomatch' })).toBe(false);
  });

  it('requires all tags', () => {
    expect(itemMatchesFilter(item, { tags: ['bug'] })).toBe(true);
    expect(itemMatchesFilter(item, { tags: ['bug', 'urgent'] })).toBe(true);
    expect(itemMatchesFilter(item, { tags: ['bug', 'missing'] })).toBe(false);
  });

  it('matches any of the listed assignees', () => {
    const assigned = { ...item, assignees: ['user:default/bob', 'text:Jane'] };
    expect(itemMatchesFilter(assigned, { assignees: [] })).toBe(true);
    expect(
      itemMatchesFilter(assigned, { assignees: ['user:default/bob'] }),
    ).toBe(true);
    expect(itemMatchesFilter(assigned, { assignees: ['text:Jane'] })).toBe(
      true,
    );
    expect(
      itemMatchesFilter(assigned, {
        assignees: ['user:default/carol', 'text:Jane'],
      }),
    ).toBe(true);
    expect(
      itemMatchesFilter(assigned, { assignees: ['user:default/carol'] }),
    ).toBe(false);
  });

  it('never matches an unassigned item on an assignee filter', () => {
    expect(itemMatchesFilter(item, { assignees: ['user:default/bob'] })).toBe(
      false,
    );
  });

  it('matches any of the listed priorities', () => {
    const prioritized = { ...item, priorityId: 'p1' };
    expect(itemMatchesFilter(prioritized, { priorities: [] })).toBe(true);
    expect(itemMatchesFilter(prioritized, { priorities: ['p1'] })).toBe(true);
    expect(itemMatchesFilter(prioritized, { priorities: ['p2', 'p1'] })).toBe(
      true,
    );
    expect(itemMatchesFilter(prioritized, { priorities: ['p2'] })).toBe(false);
  });

  it('never matches an item without priority on a priority filter', () => {
    expect(itemMatchesFilter(item, { priorities: ['p1'] })).toBe(false);
  });

  it('combines filters with AND', () => {
    expect(
      itemMatchesFilter(item, {
        text: 'login',
        tags: ['bug'],
      }),
    ).toBe(true);
    expect(itemMatchesFilter(item, { text: 'login', tags: ['missing'] })).toBe(
      false,
    );
    const assigned = { ...item, assignees: ['user:default/bob'] };
    expect(
      itemMatchesFilter(assigned, {
        text: 'login',
        tags: ['bug'],
        assignees: ['user:default/bob'],
      }),
    ).toBe(true);
    expect(
      itemMatchesFilter(assigned, {
        text: 'login',
        tags: ['bug'],
        assignees: ['user:default/carol'],
      }),
    ).toBe(false);
  });

  it('matches only overdue items while the overdue flag is set', () => {
    const overdueItem = { ...item, dueDate: '2000-01-01' };
    const dueToday = { ...item, dueDate: todayISO() };
    expect(itemMatchesFilter(overdueItem, { overdue: true })).toBe(true);
    expect(itemMatchesFilter(dueToday, { overdue: true })).toBe(false);
    expect(itemMatchesFilter(item, { overdue: true })).toBe(false);
    expect(itemMatchesFilter(item, { overdue: false })).toBe(true);
  });

  it('counts the overdue flag as an active filter', () => {
    expect(isEmptyFilter({ overdue: true })).toBe(false);
    expect(isEmptyFilter({ overdue: false })).toBe(true);
  });
});

describe('normalizeTags', () => {
  it('strips #, trims, dedupes, drops empties', () => {
    expect(normalizeTags(['#bug', 'bug', ' ui ', '#', '', 'a#b'])).toEqual([
      'bug',
      'ui',
      'ab',
    ]);
  });
});
