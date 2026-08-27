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
};

describe('itemMatchesFilter', () => {
  it('matches everything on an empty filter', () => {
    expect(itemMatchesFilter(item, {})).toBe(true);
    expect(isEmptyFilter({})).toBe(true);
    expect(isEmptyFilter({ text: '  ' })).toBe(true);
    expect(isEmptyFilter({ tags: ['x'] })).toBe(false);
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

  it('combines filters with AND', () => {
    expect(
      itemMatchesFilter(item, {
        text: 'login',
        tags: ['bug'],
      }),
    ).toBe(true);
    expect(
      itemMatchesFilter(item, { text: 'login', tags: ['missing'] }),
    ).toBe(false);
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
