import { Knex } from 'knex';
import { BoardsService } from './BoardsService';
import {
  alice,
  anonymous,
  bob,
  carol,
  createTestService,
  syncService,
} from './testUtils';

describe('BoardsService', () => {
  let knex: Knex;
  let service: BoardsService;
  let notifications: { send: jest.Mock };
  let signals: { publish: jest.Mock };

  beforeEach(async () => {
    ({ knex, service, notifications, signals } = await createTestService());
  });

  afterEach(async () => {
    await knex.destroy();
  });

  describe('boards', () => {
    it('creates a board with default columns and creator as admin', async () => {
      const board = await service.createBoard(alice, { name: 'Team Alpha' });
      expect(board.name).toBe('Team Alpha');
      expect(board.access).toBe('admin');
      expect(board.columns.length).toBeGreaterThan(0);
      expect(board.visibility).toBe('private');
      expect(board.createdBy).toBe('user:default/alice');
    });

    it('rejects empty names', async () => {
      await expect(
        service.createBoard(alice, { name: '   ' }),
      ).rejects.toThrow('name must not be empty');
    });

    it('rejects anonymous creation', async () => {
      await expect(
        service.createBoard(anonymous, { name: 'X' }),
      ).rejects.toThrow(/requires authentication/);
    });

    it('hides private boards from other users as not-found', async () => {
      const board = await service.createBoard(alice, { name: 'Secret' });
      await expect(service.getBoard(bob, board.id)).rejects.toThrow(
        /not found/,
      );
      const list = await service.listBoards(bob);
      expect(list).toHaveLength(0);
    });

    it('lists boards accessible via direct, group, and public grants', async () => {
      const own = await service.createBoard(alice, { name: 'Own' });
      const viaGroup = await service.createBoard(bob, { name: 'Group Shared' });
      await service.addPermission(bob, viaGroup.id, {
        principalRef: 'group:default/team-a',
        level: 'read',
      });
      const publicBoard = await service.createBoard(bob, {
        name: 'Public',
        visibility: 'public-read',
      });
      await service.createBoard(bob, { name: 'Hidden' });

      const list = await service.listBoards(alice);
      expect(list.map(b => b.id).sort()).toEqual(
        [own.id, viaGroup.id, publicBoard.id].sort(),
      );
      expect(list.find(b => b.id === viaGroup.id)?.access).toBe('read');
    });

    it('filters the listing by assigned entity, access still enforced', async () => {
      const mine = await service.createBoard(alice, {
        name: 'Mine',
        entityRef: 'system:default/payments',
      });
      await service.createBoard(alice, { name: 'Other entity' });
      await service.createBoard(bob, {
        name: 'Inaccessible',
        entityRef: 'system:default/payments',
      });
      const filtered = await service.listBoards(alice, {
        entityRef: 'system:default/payments',
      });
      expect(filtered.map(board => board.id)).toEqual([mine.id]);
    });

    it('effective level is the highest grant', async () => {
      const board = await service.createBoard(bob, { name: 'B' });
      await service.addPermission(bob, board.id, {
        principalRef: 'user:default/alice',
        level: 'read',
      });
      await service.addPermission(bob, board.id, {
        principalRef: 'group:default/team-a',
        level: 'write',
      });
      const fetched = await service.getBoard(alice, board.id);
      expect(fetched.access).toBe('write');
    });

    it('only admins can rename or delete', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      await service.addPermission(alice, board.id, {
        principalRef: 'user:default/bob',
        level: 'write',
      });
      await expect(
        service.updateBoard(bob, board.id, { name: 'New' }),
      ).rejects.toThrow(/requires 'admin'/);
      await expect(service.deleteBoard(bob, board.id)).rejects.toThrow(
        /requires 'admin'/,
      );
      const renamed = await service.updateBoard(alice, board.id, {
        name: 'New',
      });
      expect(renamed.name).toBe('New');
    });

    it('deletes a board with all data', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await service.addComment(alice, board.id, item.id, 'hello');
      await service.setWatchItem(alice, board.id, item.id, true);
      await service.deleteBoard(alice, board.id);
      await expect(service.getBoard(alice, board.id)).rejects.toThrow(
        /not found/,
      );
      expect(await knex('items')).toHaveLength(0);
      expect(await knex('comments')).toHaveLength(0);
      expect(await knex('comment_versions')).toHaveLength(0);
      expect(await knex('changes')).toHaveLength(0);
      expect(await knex('watches')).toHaveLength(0);
    });

    it('manages entity assignment', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const assigned = await service.updateBoard(alice, board.id, {
        entityRef: 'system:default/payments',
      });
      expect(assigned.entityRef).toBe('system:default/payments');
      const cleared = await service.updateBoard(alice, board.id, {
        entityRef: null,
      });
      expect(cleared.entityRef).toBeUndefined();
    });

    it('tracks per-user favorites', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-read',
      });
      await service.setFavorite(alice, board.id, true);
      expect(
        (await service.listBoards(alice, { favoritesOnly: true })).map(
          b => b.id,
        ),
      ).toEqual([board.id]);
      expect(
        await service.listBoards(bob, { favoritesOnly: true }),
      ).toHaveLength(0);
      await service.setFavorite(alice, board.id, false);
      expect(
        await service.listBoards(alice, { favoritesOnly: true }),
      ).toHaveLength(0);
    });
  });

  describe('permissions', () => {
    it('rejects invalid principals and duplicate entries', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      await expect(
        service.addPermission(alice, board.id, {
          principalRef: 'text:someone',
          level: 'read',
        }),
      ).rejects.toThrow(/Invalid principal/);
      await expect(
        service.addPermission(alice, board.id, {
          principalRef: 'component:default/thing',
          level: 'read',
        }),
      ).rejects.toThrow(/Invalid principal/);
      await service.addPermission(alice, board.id, {
        principalRef: 'user:default/bob',
        level: 'read',
      });
      await expect(
        service.addPermission(alice, board.id, {
          principalRef: 'user:default/bob',
          level: 'write',
        }),
      ).rejects.toThrow(/already has access/);
    });

    it('revoking removes derived access', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const entry = await service.addPermission(alice, board.id, {
        principalRef: 'user:default/bob',
        level: 'read',
      });
      await service.getBoard(bob, board.id);
      await service.removePermission(alice, board.id, entry.id);
      await expect(service.getBoard(bob, board.id)).rejects.toThrow(
        /not found/,
      );
    });

    it('protects the last admin from removal and downgrade', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const entries = await service.listPermissions(alice, board.id);
      const adminEntry = entries.find(e => e.level === 'admin')!;
      await expect(
        service.removePermission(alice, board.id, adminEntry.id),
      ).rejects.toThrow(/at least one admin/);
      await expect(
        service.updatePermission(alice, board.id, adminEntry.id, 'read'),
      ).rejects.toThrow(/at least one admin/);
      // adding a second admin unblocks removal
      await service.addPermission(alice, board.id, {
        principalRef: 'user:default/bob',
        level: 'admin',
      });
      await service.removePermission(alice, board.id, adminEntry.id);
    });

    it('only admins can manage permissions', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      await service.addPermission(alice, board.id, {
        principalRef: 'user:default/bob',
        level: 'write',
      });
      await expect(service.listPermissions(bob, board.id)).rejects.toThrow(
        /requires 'admin'/,
      );
      await expect(
        service.addPermission(bob, board.id, {
          principalRef: 'user:default/carol',
          level: 'read',
        }),
      ).rejects.toThrow(/requires 'admin'/);
    });
  });

  describe('columns', () => {
    it('adds, renames, reorders and deletes columns', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const col = await service.addColumn(alice, board.id, {
        title: 'In Review',
      });
      const renamed = await service.updateColumn(alice, board.id, col.id, {
        title: 'Review',
      });
      expect(renamed.title).toBe('Review');
      await service.updateColumn(alice, board.id, col.id, { position: 1 });
      const fresh = await service.getBoard(alice, board.id);
      expect(fresh.columns[0].id).toBe(col.id);
      await service.deleteColumn(alice, board.id, col.id);
      const after = await service.getBoard(alice, board.id);
      expect(after.columns.find(c => c.id === col.id)).toBeUndefined();
    });

    it('items keep their column association across renames', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const col = board.columns[0];
      const item = await service.createItem(alice, board.id, {
        columnId: col.id,
        title: 'Item',
      });
      await service.updateColumn(alice, board.id, col.id, { title: 'Later' });
      const fetched = await service.getItem(alice, board.id, item.id);
      expect(fetched.columnId).toBe(col.id);
    });

    it('requires a target column when deleting a non-empty column', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const [colA, colB] = board.columns;
      const item = await service.createItem(alice, board.id, {
        columnId: colA.id,
        title: 'Item',
      });
      await expect(
        service.deleteColumn(alice, board.id, colA.id),
      ).rejects.toThrow(/still contains items/);
      await service.deleteColumn(alice, board.id, colA.id, {
        moveItemsTo: colB.id,
      });
      const moved = await service.getItem(alice, board.id, item.id);
      expect(moved.columnId).toBe(colB.id);
    });

    it('read-only users cannot manage columns', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-read',
      });
      await expect(
        service.addColumn(bob, board.id, { title: 'X' }),
      ).rejects.toThrow(/requires 'write'/);
    });
  });

  describe('items', () => {
    it('creates items with audit fields and associations', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Fix login bug',
        assignees: ['user:default/bob', 'text:Jane (agency)'],
        labels: { priority: 'high' },
        tags: ['bug'],
      });
      expect(item.createdBy).toBe('user:default/alice');
      expect(item.createdAt).toBeTruthy();
      expect(item.assignees.sort()).toEqual([
        'text:Jane (agency)',
        'user:default/bob',
      ]);
      expect(item.labels).toEqual({ priority: 'high' });
      expect(item.tags).toEqual(['bug']);
    });

    it('rejects empty titles and invalid refs', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const columnId = board.columns[0].id;
      await expect(
        service.createItem(alice, board.id, { columnId, title: ' ' }),
      ).rejects.toThrow(/title must not be empty/);
      await expect(
        service.createItem(alice, board.id, {
          columnId,
          title: 'X',
          assignees: ['not a ref !!'],
        }),
      ).rejects.toThrow(/Invalid reference/);
      await expect(
        service.createItem(alice, board.id, {
          columnId,
          title: 'X',
          assignees: ['text:'],
        }),
      ).rejects.toThrow(/Invalid reference/);
    });

    it('read-only users cannot mutate items', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-read',
      });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await expect(
        service.createItem(bob, board.id, {
          columnId: board.columns[0].id,
          title: 'Nope',
        }),
      ).rejects.toThrow(/requires 'write'/);
      await expect(
        service.updateItem(bob, board.id, item.id, { title: 'Nope' }),
      ).rejects.toThrow(/requires 'write'/);
      await expect(
        service.deleteItem(bob, board.id, item.id),
      ).rejects.toThrow(/requires 'write'/);
    });

    it('records change entries for field updates', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'A',
      });
      await service.updateItem(alice, board.id, item.id, {
        title: 'B',
        tags: ['x'],
      });
      const timeline = await service.getTimeline(alice, board.id, item.id);
      const changes = timeline
        .filter(e => e.kind === 'change')
        .map(e => (e.kind === 'change' ? e.change : undefined)!);
      expect(changes.map(c => c.type)).toContain('created');
      const titleChange = changes.find(c => c.field === 'title');
      expect(titleChange?.oldValue).toBe('A');
      expect(titleChange?.newValue).toBe('B');
      expect(changes.find(c => c.field === 'tags')).toBeTruthy();
    });

    it('moves items and records the status transition', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const [todo, doing] = board.columns;
      const item = await service.createItem(alice, board.id, {
        columnId: todo.id,
        title: 'Item',
      });
      const moved = await service.moveItem(alice, board.id, item.id, {
        columnId: doing.id,
        position: 42,
      });
      expect(moved.columnId).toBe(doing.id);
      expect(moved.position).toBe(42);
      const timeline = await service.getTimeline(alice, board.id, item.id);
      const move = timeline.find(
        e => e.kind === 'change' && e.change.type === 'moved',
      );
      expect(move && move.kind === 'change' && move.change.oldValue).toBe(
        todo.title,
      );
      expect(move && move.kind === 'change' && move.change.newValue).toBe(
        doing.title,
      );
    });

    it('archives items on delete and restores them with history', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await service.addComment(alice, board.id, item.id, 'keep me');
      await service.deleteItem(alice, board.id, item.id);
      // hidden from views, but still archived-listable
      expect(await service.listItems(alice, board.id)).toHaveLength(0);
      const archived = await service.listArchivedItems(alice, board.id);
      expect(archived.map(entry => entry.id)).toEqual([item.id]);
      expect(archived[0].archivedBy).toBe('user:default/alice');
      // mutations on archived items are rejected
      await expect(
        service.updateItem(alice, board.id, item.id, { title: 'X' }),
      ).rejects.toThrow(/archived/);
      await expect(
        service.addComment(alice, board.id, item.id, 'nope'),
      ).rejects.toThrow(/archived/);
      // restore brings everything back
      const restored = await service.restoreItem(alice, board.id, item.id);
      expect(restored.archivedAt).toBeUndefined();
      expect(await service.listItems(alice, board.id)).toHaveLength(1);
      const timeline = await service.getTimeline(alice, board.id, item.id);
      const types = timeline
        .filter(entry => entry.kind === 'change')
        .map(entry => (entry.kind === 'change' ? entry.change.type : ''));
      expect(types).toContain('archived');
      expect(types).toContain('restored');
      expect(timeline.some(entry => entry.kind === 'comment')).toBe(true);
    });

    it('read-only users cannot restore', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-read',
      });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await service.deleteItem(alice, board.id, item.id);
      await expect(
        service.restoreItem(bob, board.id, item.id),
      ).rejects.toThrow(/requires 'write'/);
      await expect(service.listArchivedItems(bob, board.id)).rejects.toThrow(
        /requires 'write'/,
      );
    });

    it('purges only items archived before the cutoff', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const oldItem = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Old',
      });
      const newItem = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'New',
      });
      await service.deleteItem(alice, board.id, oldItem.id);
      await service.deleteItem(alice, board.id, newItem.id);
      // backdate the first archival beyond the retention window
      const past = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await knex('items')
        .where('id', oldItem.id)
        .update({ archived_at: past.toISOString() });
      const purged = await service.purgeArchivedItems(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      );
      expect(purged).toBe(1);
      const remaining = await service.listArchivedItems(alice, board.id);
      expect(remaining.map(entry => entry.title)).toEqual(['New']);
      expect(await knex('changes').where('item_id', oldItem.id)).toHaveLength(0);
    });
  });

  describe('board change feed', () => {
    it('lists recent changes newest first with item titles', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'First',
      });
      await service.updateItem(alice, board.id, item.id, { title: 'Renamed' });
      await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Second',
      });
      const changes = await service.getBoardChanges(alice, board.id);
      expect(changes.length).toBe(3);
      expect(changes[0].itemTitle).toBe('Second');
      expect(changes[0].change.type).toBe('created');
      expect(changes.map(entry => entry.change.at)).toEqual(
        [...changes.map(entry => entry.change.at)].sort().reverse(),
      );
      const limited = await service.getBoardChanges(alice, board.id, {
        limit: 1,
      });
      expect(limited).toHaveLength(1);
    });

    it('requires read access', async () => {
      const board = await service.createBoard(alice, { name: 'Hidden' });
      await expect(service.getBoardChanges(bob, board.id)).rejects.toThrow(
        /not found/,
      );
    });
  });

  describe('signals', () => {
    it('broadcasts id-only signals on item and column mutations', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      signals.publish.mockClear();
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      expect(signals.publish).toHaveBeenCalledWith({
        recipients: { type: 'broadcast' },
        channel: 'boards',
        message: { boardId: board.id, itemId: item.id },
      });
      signals.publish.mockClear();
      await service.moveItem(alice, board.id, item.id, {
        columnId: board.columns[1].id,
      });
      expect(signals.publish).toHaveBeenCalledTimes(1);
      signals.publish.mockClear();
      await service.addColumn(alice, board.id, { title: 'New' });
      expect(signals.publish).toHaveBeenCalledWith({
        recipients: { type: 'broadcast' },
        channel: 'boards',
        message: { boardId: board.id },
      });
    });
  });

  describe('item filtering', () => {
    async function seedFilterBoard() {
      const board = await service.createBoard(alice, { name: 'B' });
      const columnId = board.columns[0].id;
      await service.createItem(alice, board.id, {
        columnId,
        title: 'Fix login bug',
        tags: ['bug', 'urgent'],
        labels: { priority: 'high', env: 'prod' },
      });
      const withDescription = await service.createItem(alice, board.id, {
        columnId,
        title: 'Improve docs',
        tags: ['docs'],
        labels: { priority: 'low' },
      });
      await service.updateItem(alice, board.id, withDescription.id, {
        description: 'covers the LOGIN flow',
      });
      await service.createItem(alice, board.id, { columnId, title: 'Chore' });
      return board;
    }

    it('filters by text over title and description', async () => {
      const board = await seedFilterBoard();
      const byText = await service.listItems(alice, board.id, {
        text: 'login',
      });
      expect(byText.map(i => i.title).sort()).toEqual([
        'Fix login bug',
        'Improve docs',
      ]);
    });

    it('requires all tags and all label pairs', async () => {
      const board = await seedFilterBoard();
      expect(
        (await service.listItems(alice, board.id, { tags: ['bug'] })).map(
          i => i.title,
        ),
      ).toEqual(['Fix login bug']);
      expect(
        await service.listItems(alice, board.id, {
          tags: ['bug', 'missing'],
        }),
      ).toHaveLength(0);
      expect(
        (
          await service.listItems(alice, board.id, {
            labels: { priority: 'high', env: 'prod' },
          })
        ).map(i => i.title),
      ).toEqual(['Fix login bug']);
      expect(
        await service.listItems(alice, board.id, {
          labels: { priority: 'nope' },
        }),
      ).toHaveLength(0);
    });

    it('combines filters with AND', async () => {
      const board = await seedFilterBoard();
      expect(
        (
          await service.listItems(alice, board.id, {
            text: 'login',
            tags: ['bug'],
            labels: { env: 'prod' },
          })
        ).map(i => i.title),
      ).toEqual(['Fix login bug']);
      expect(
        await service.listItems(alice, board.id, {
          text: 'login',
          tags: ['docs'],
          labels: { env: 'prod' },
        }),
      ).toHaveLength(0);
    });
  });

  describe('item description', () => {
    it('keeps versions and records a change on each edit', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      expect(item.description).toBeUndefined();
      expect(item.descriptionVersionCount).toBe(0);

      const withDescription = await service.updateItem(
        alice,
        board.id,
        item.id,
        { description: 'First **draft**' },
      );
      expect(withDescription.description).toBe('First **draft**');
      expect(withDescription.descriptionVersionCount).toBe(1);

      const edited = await service.updateItem(alice, board.id, item.id, {
        description: 'Final text',
      });
      expect(edited.description).toBe('Final text');
      expect(edited.descriptionVersionCount).toBe(2);

      const versions = await service.listDescriptionVersions(
        alice,
        board.id,
        item.id,
      );
      expect(versions.map(v => v.text)).toEqual(['First **draft**', 'Final text']);
      expect(versions[0].editedBy).toBe('user:default/alice');

      const timeline = await service.getTimeline(alice, board.id, item.id);
      const descriptionChanges = timeline.filter(
        e => e.kind === 'change' && e.change.field === 'description',
      );
      expect(descriptionChanges).toHaveLength(2);
    });

    it('skips unchanged descriptions and supports clearing', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await service.updateItem(alice, board.id, item.id, {
        description: 'Text',
      });
      const same = await service.updateItem(alice, board.id, item.id, {
        description: 'Text',
      });
      expect(same.descriptionVersionCount).toBe(1);
      const cleared = await service.updateItem(alice, board.id, item.id, {
        description: '',
      });
      expect(cleared.description).toBeUndefined();
      expect(cleared.descriptionVersionCount).toBe(2);
    });

    it('rejects description edits on external items by users', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(syncService, board.id, {
        columnId: board.columns[0].id,
        title: 'PR #1',
        externalManager: 'github',
      });
      await expect(
        service.updateItem(alice, board.id, item.id, { description: 'x' }),
      ).rejects.toThrow(/read-only/);
    });
  });

  describe('externally managed items', () => {
    it('only service callers may create external items', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-write',
      });
      await expect(
        service.createItem(alice, board.id, {
          columnId: board.columns[0].id,
          title: 'PR #1',
          externalManager: 'github',
        }),
      ).rejects.toThrow(/Only service callers/);
      const item = await service.createItem(syncService, board.id, {
        columnId: board.columns[0].id,
        title: 'PR #1',
        externalManager: 'github',
      });
      expect(item.externalManager).toBe('github');
    });

    it('rejects user mutations of external items but allows the service', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(syncService, board.id, {
        columnId: board.columns[0].id,
        title: 'PR #1',
        externalManager: 'github',
      });
      await expect(
        service.updateItem(alice, board.id, item.id, { title: 'Hacked' }),
      ).rejects.toThrow(/read-only/);
      await expect(
        service.moveItem(alice, board.id, item.id, {
          columnId: board.columns[1].id,
        }),
      ).rejects.toThrow(/read-only/);
      await expect(
        service.deleteItem(alice, board.id, item.id),
      ).rejects.toThrow(/read-only/);
      const updated = await service.updateItem(syncService, board.id, item.id, {
        title: 'PR #1 (merged)',
      });
      expect(updated.title).toBe('PR #1 (merged)');
    });

    it('still allows comments on external items', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(syncService, board.id, {
        columnId: board.columns[0].id,
        title: 'PR #1',
        externalManager: 'github',
      });
      const comment = await service.addComment(
        alice,
        board.id,
        item.id,
        'looks good',
      );
      expect(comment.text).toBe('looks good');
    });
  });

  describe('comments', () => {
    it('keeps prior versions on edit', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      const comment = await service.addComment(alice, board.id, item.id, 'v1');
      expect(comment.versionCount).toBe(1);
      const edited = await service.updateComment(
        alice,
        board.id,
        item.id,
        comment.id,
        'v2',
      );
      expect(edited.text).toBe('v2');
      expect(edited.versionCount).toBe(2);
      expect(edited.editedBy).toBe('user:default/alice');
      const versions = await service.listCommentVersions(
        alice,
        board.id,
        item.id,
        comment.id,
      );
      expect(versions.map(v => v.text)).toEqual(['v1', 'v2']);
    });

    it('only the author or a board admin may edit', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-write',
      });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      const comment = await service.addComment(bob, board.id, item.id, 'v1');
      // carol has write access via visibility but is neither author nor admin
      await expect(
        service.updateComment(carol, board.id, item.id, comment.id, 'x'),
      ).rejects.toThrow(/author or a board admin/);
      // alice is board admin
      const byAdmin = await service.updateComment(
        alice,
        board.id,
        item.id,
        comment.id,
        'fixed',
      );
      expect(byAdmin.text).toBe('fixed');
    });

    it('read-only users cannot comment', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-read',
      });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await expect(
        service.addComment(bob, board.id, item.id, 'hi'),
      ).rejects.toThrow(/requires 'write'/);
    });

    it('interleaves comments and changes chronologically in the timeline', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'A',
      });
      await service.addComment(alice, board.id, item.id, 'first');
      await service.updateItem(alice, board.id, item.id, { title: 'B' });
      const timeline = await service.getTimeline(alice, board.id, item.id);
      expect(timeline.length).toBeGreaterThanOrEqual(3);
      const sorted = [...timeline].sort((a, b) => a.at.localeCompare(b.at));
      expect(timeline).toEqual(sorted);
      expect(timeline.some(e => e.kind === 'comment')).toBe(true);
      expect(timeline.some(e => e.kind === 'change')).toBe(true);
    });
  });

  describe('watching and notifications', () => {
    async function setupWatchedItem() {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-write',
      });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      notifications.send.mockClear();
      return { board, item };
    }

    it('notifies item watchers on moves with a link', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchItem(carol, board.id, item.id, true);
      await service.moveItem(alice, board.id, item.id, {
        columnId: board.columns[1].id,
      });
      expect(notifications.send).toHaveBeenCalledTimes(1);
      const call = notifications.send.mock.calls[0][0];
      expect(call.recipients).toEqual({
        type: 'entity',
        entityRef: ['user:default/carol'],
      });
      expect(call.payload.link).toBe(`/boards/${board.id}?item=${item.id}`);
    });

    it('notifies board watchers about item changes', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchBoard(carol, board.id, true);
      await service.updateItem(alice, board.id, item.id, { title: 'New' });
      expect(notifications.send).toHaveBeenCalledTimes(1);
      expect(notifications.send.mock.calls[0][0].recipients.entityRef).toEqual([
        'user:default/carol',
      ]);
    });

    it('does not notify the actor about their own change', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchItem(alice, board.id, item.id, true);
      await service.updateItem(alice, board.id, item.id, { title: 'New' });
      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('sends one notification when watching both board and item', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchBoard(carol, board.id, true);
      await service.setWatchItem(carol, board.id, item.id, true);
      await service.updateItem(alice, board.id, item.id, { title: 'New' });
      expect(notifications.send).toHaveBeenCalledTimes(1);
      expect(notifications.send.mock.calls[0][0].recipients.entityRef).toEqual([
        'user:default/carol',
      ]);
    });

    it('notifies on comments and stops after unwatch', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchItem(carol, board.id, item.id, true);
      await service.addComment(alice, board.id, item.id, 'hi');
      expect(notifications.send).toHaveBeenCalledTimes(1);
      notifications.send.mockClear();
      await service.setWatchItem(carol, board.id, item.id, false);
      await service.addComment(alice, board.id, item.id, 'again');
      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('lists board and item watchers for readers', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchBoard(carol, board.id, true);
      await service.setWatchItem(carol, board.id, item.id, true);
      await service.setWatchItem(bob, board.id, item.id, true);
      expect(await service.listBoardWatchers(bob, board.id)).toEqual([
        'user:default/carol',
      ]);
      expect(await service.listItemWatchers(bob, board.id, item.id)).toEqual([
        'user:default/bob',
        'user:default/carol',
      ]);
    });

    it('rejects watcher listing without read access', async () => {
      const board = await service.createBoard(alice, { name: 'Hidden' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await expect(service.listBoardWatchers(bob, board.id)).rejects.toThrow(
        /not found/,
      );
      await expect(
        service.listItemWatchers(bob, board.id, item.id),
      ).rejects.toThrow(/not found/);
    });

    it('notifies mentioned non-watchers in comments', async () => {
      const { board, item } = await setupWatchedItem();
      await service.addComment(
        alice,
        board.id,
        item.id,
        'please look @user:default/carol',
      );
      expect(notifications.send).toHaveBeenCalledTimes(1);
      const call = notifications.send.mock.calls[0][0];
      expect(call.recipients.entityRef).toEqual(['user:default/carol']);
      expect(call.payload.title).toMatch(/mentioned/i);
      expect(call.payload.link).toContain(`item=${item.id}`);
    });

    it('mentioned watchers get exactly one notification, actors none', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchItem(carol, board.id, item.id, true);
      await service.addComment(alice, board.id, item.id, 'fyi @carol and me @user:default/alice');
      // carol: only the mention; alice: nothing despite self-mention
      expect(notifications.send).toHaveBeenCalledTimes(1);
      const call = notifications.send.mock.calls[0][0];
      expect(call.recipients.entityRef).toEqual(['user:default/carol']);
      expect(call.payload.title).toMatch(/mentioned/i);
    });

    it('notifies mentions in description edits', async () => {
      const { board, item } = await setupWatchedItem();
      await service.updateItem(alice, board.id, item.id, {
        description: 'owned by @group:default/guests',
      });
      const mentionCall = notifications.send.mock.calls.find(
        (call: any[]) => call[0].payload.title === 'You were mentioned',
      );
      expect(mentionCall?.[0].recipients.entityRef).toEqual([
        'group:default/guests',
      ]);
    });

    it('notifies watchers when an item is archived', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchItem(carol, board.id, item.id, true);
      await service.deleteItem(alice, board.id, item.id);
      expect(notifications.send).toHaveBeenCalledTimes(1);
      expect(notifications.send.mock.calls[0][0].payload.title).toMatch(
        /archived/i,
      );
    });
  });
});
