import { BoardItem } from '@internal/plugin-boards-common';
import {
  filterDueEntries,
  groupByAssignee,
  groupItems,
  groupMyItems,
  NO_DUE_DATE,
  positionBefore,
  sortItems,
  UNASSIGNED,
  UNTAGGED,
} from './grouping';
import { testMyItem } from './__testUtils__/testHelpers';

function item(id: string, assignees: string[]): BoardItem {
  return {
    id,
    boardId: 'b',
    columnId: 'c',
    position: 0,
    title: id,
    createdBy: 'user:default/alice',
    createdAt: '2026-01-01T00:00:00Z',
    updatedBy: 'user:default/alice',
    updatedAt: '2026-01-01T00:00:00Z',
    assignees,
    descriptionVersionCount: 0,
    tags: [],
  };
}

describe('groupByAssignee', () => {
  it('groups items per assignee with unassigned last', () => {
    const groups = groupByAssignee([
      item('1', ['user:default/bob']),
      item('2', []),
      item('3', ['user:default/alice']),
    ]);
    expect(groups.map(g => g.key)).toEqual([
      'user:default/alice',
      'user:default/bob',
      UNASSIGNED,
    ]);
  });

  it('shows multi-assignee items in each group', () => {
    const groups = groupByAssignee([
      item('1', ['user:default/alice', 'user:default/bob']),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items[0].id).toBe('1');
    expect(groups[1].items[0].id).toBe('1');
  });

  it('omits the unassigned group when empty', () => {
    const groups = groupByAssignee([item('1', ['user:default/alice'])]);
    expect(groups.map(g => g.key)).toEqual(['user:default/alice']);
  });
});

describe('sortItems', () => {
  const columns = [
    { id: 'c1', boardId: 'b', title: 'To do', position: 1 },
    { id: 'c2', boardId: 'b', title: 'Done', position: 2 },
  ];
  const items = [
    { ...item('Beta', []), columnId: 'c2', updatedAt: '2026-01-02T00:00:00Z' },
    { ...item('alpha', []), columnId: 'c1', updatedAt: '2026-01-03T00:00:00Z' },
    { ...item('Gamma', []), columnId: 'c1', updatedAt: '2026-01-01T00:00:00Z' },
  ].map(entry => ({ ...entry, title: entry.id }));

  it('keeps board order without a descriptor', () => {
    expect(sortItems(items, undefined, columns)).toBe(items);
  });

  it('sorts by title case-insensitively in both directions', () => {
    expect(
      sortItems(
        items,
        { column: 'title', direction: 'ascending' },
        columns,
      ).map(entry => entry.title),
    ).toEqual(['alpha', 'Beta', 'Gamma']);
    expect(
      sortItems(
        items,
        { column: 'title', direction: 'descending' },
        columns,
      ).map(entry => entry.title),
    ).toEqual(['Gamma', 'Beta', 'alpha']);
  });

  it('sorts by status title and updated timestamp', () => {
    expect(
      sortItems(
        items,
        { column: 'status', direction: 'ascending' },
        columns,
      ).map(entry => entry.columnId),
    ).toEqual(['c2', 'c1', 'c1']);
    expect(
      sortItems(
        items,
        { column: 'updatedAt', direction: 'descending' },
        columns,
      ).map(entry => entry.updatedAt),
    ).toEqual([
      '2026-01-03T00:00:00Z',
      '2026-01-02T00:00:00Z',
      '2026-01-01T00:00:00Z',
    ]);
  });
});

describe('positionBefore', () => {
  const sorted = [{ position: 1000 }, { position: 2000 }];
  it('computes midpoints and edges', () => {
    expect(positionBefore(sorted, 0)).toBe(500);
    expect(positionBefore(sorted, 1)).toBe(1500);
    expect(positionBefore(sorted, 2)).toBe(3000);
    expect(positionBefore([], 0)).toBe(1000);
  });
});

describe('groupItems', () => {
  const mk = (over: Partial<BoardItem>): BoardItem =>
    ({
      id: over.id ?? 'x',
      boardId: 'b',
      columnId: 'c',
      position: 1,
      title: over.title ?? 'T',
      createdBy: 'user:default/alice',
      createdAt: '',
      updatedBy: 'user:default/alice',
      updatedAt: '',
      descriptionVersionCount: 0,
      assignees: over.assignees ?? [],
      tags: over.tags ?? [],
      dueDate: over.dueDate,
    } as BoardItem);

  it('groups by due date with the undated group last', () => {
    const groups = groupItems(
      [
        mk({ id: '1', dueDate: '2026-09-01' }),
        mk({ id: '2' }),
        mk({ id: '3', dueDate: '2026-08-01' }),
        mk({ id: '4', dueDate: '2026-09-01' }),
      ],
      'dueDate',
    );
    expect(groups.map(group => group.key)).toEqual([
      '2026-08-01',
      '2026-09-01',
      NO_DUE_DATE,
    ]);
    expect(groups[1].items.map(entry => entry.id)).toEqual(['1', '4']);
  });

  it('groups by tags with multi-membership and untagged last', () => {
    const groups = groupItems(
      [
        mk({ id: '1', tags: ['ui', 'bug'] }),
        mk({ id: '2', tags: ['bug'] }),
        mk({ id: '3' }),
      ],
      'tags',
    );
    expect(groups.map(group => group.key)).toEqual(['bug', 'ui', UNTAGGED]);
    expect(groups[0].items.map(entry => entry.id)).toEqual(['1', '2']);
  });

  it('none returns a single group', () => {
    expect(groupItems([mk({ id: '1' })], 'none')).toHaveLength(1);
  });
});

describe('filterDueEntries', () => {
  const now = new Date(2026, 7, 27); // 2026-08-27, local

  it('keeps overdue and due-today entries, drops future and undated ones', () => {
    const overdue = testMyItem({ item: { id: 'a', dueDate: '2026-08-26' } });
    const today = testMyItem({ item: { id: 'b', dueDate: '2026-08-27' } });
    const future = testMyItem({ item: { id: 'c', dueDate: '2026-09-03' } });
    const undated = testMyItem({ item: { id: 'd' } });

    expect(
      filterDueEntries([overdue, today, future, undated], now).map(
        entry => entry.item.id,
      ),
    ).toEqual(['a', 'b']);
  });

  it('keeps nothing when nothing is due', () => {
    const future = testMyItem({ item: { dueDate: '2026-12-24' } });
    expect(filterDueEntries([future], now)).toEqual([]);
  });
});

describe('groupMyItems', () => {
  it('groups by board, ordered alphabetically by board name', () => {
    const entries = [
      testMyItem({ boardId: 'b-2', boardName: 'Zebra', item: { id: '1' } }),
      testMyItem({ boardId: 'b-1', boardName: 'Alpha', item: { id: '2' } }),
      testMyItem({ boardId: 'b-2', boardName: 'Zebra', item: { id: '3' } }),
    ];
    expect(
      groupMyItems(entries, 'board').map(group => [
        group.key,
        group.label,
        group.entries.length,
      ]),
    ).toEqual([
      ['b-1', 'Alpha', 1],
      ['b-2', 'Zebra', 2],
    ]);
  });

  it('groups the same status from different boards together', () => {
    const entries = [
      testMyItem({ boardId: 'b-1', columnTitle: 'Todo', item: { id: '1' } }),
      testMyItem({ boardId: 'b-2', columnTitle: 'Todo', item: { id: '2' } }),
      testMyItem({ boardId: 'b-2', columnTitle: 'Done', item: { id: '3' } }),
    ];
    expect(
      groupMyItems(entries, 'status').map(group => [
        group.label,
        group.entries.map(entry => entry.item.id),
      ]),
    ).toEqual([
      ['Done', ['3']],
      ['Todo', ['1', '2']],
    ]);
  });

  it('groups by due date chronologically with undated entries last', () => {
    const entries = [
      testMyItem({ item: { id: '1' } }),
      testMyItem({ item: { id: '2', dueDate: '2026-09-01' } }),
      testMyItem({ item: { id: '3', dueDate: '2026-08-05' } }),
      testMyItem({ item: { id: '4', dueDate: '2026-09-01' } }),
    ];
    expect(
      groupMyItems(entries, 'dueDate').map(group => [
        group.key,
        group.entries.map(entry => entry.item.id),
      ]),
    ).toEqual([
      ['2026-08-05', ['3']],
      ['2026-09-01', ['2', '4']],
      [NO_DUE_DATE, ['1']],
    ]);
  });

  it('labels the undated due-date group', () => {
    const groups = groupMyItems([testMyItem()], 'dueDate');
    expect(groups).toEqual([
      expect.objectContaining({ key: NO_DUE_DATE, label: 'No due date' }),
    ]);
  });

  it('returns no groups for no entries', () => {
    expect(groupMyItems([], 'board')).toEqual([]);
    expect(groupMyItems([], 'dueDate')).toEqual([]);
  });
});
