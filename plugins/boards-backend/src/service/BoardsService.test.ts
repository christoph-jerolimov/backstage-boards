import { Knex } from 'knex';
import {
  ALL_VISIBILITIES,
  BoardVisibility,
} from '@internal/plugin-boards-common';
import { BoardsService } from './BoardsService';
import { computeEffectiveLevel } from './access';
import {
  alice,
  anonymous,
  bob,
  carol,
  createTestService,
  recipientRefs,
  syncService,
  TestService,
} from './testUtils';

describe('BoardsService', () => {
  let knex: Knex;
  let service: BoardsService;
  let notifications: TestService['notifications'];
  let signals: TestService['signals'];
  let onEntityRefsChanged: TestService['onEntityRefsChanged'];

  beforeEach(async () => {
    ({ knex, service, notifications, signals, onEntityRefsChanged } =
      await createTestService());
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
      await expect(service.createBoard(alice, { name: '   ' })).rejects.toThrow(
        'name must not be empty',
      );
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
      const { boards: list } = await service.listBoards(bob);
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

      const { boards: list } = await service.listBoards(alice);
      expect(list.map(b => b.id).sort()).toEqual(
        [own.id, viaGroup.id, publicBoard.id].sort(),
      );
      expect(list.find(b => b.id === viaGroup.id)?.access).toBe('read');
    });

    it('filters the listing by assigned entity, access still enforced', async () => {
      const mine = await service.createBoard(alice, {
        name: 'Mine',
        entityRefs: ['system:default/payments', 'group:default/team-a'],
      });
      await service.createBoard(alice, { name: 'Other entity' });
      await service.createBoard(bob, {
        name: 'Inaccessible',
        entityRefs: ['system:default/payments'],
      });
      const { boards: filtered } = await service.listBoards(alice, {
        entityRef: 'system:default/payments',
      });
      expect(filtered.map(board => board.id)).toEqual([mine.id]);
    });

    it('omits per-status counts unless they are asked for', async () => {
      const board = await service.createBoard(alice, { name: 'Counted' });
      await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'One',
      });

      const [plain] = (await service.listBoards(alice)).boards;
      expect(plain.statusCounts).toBeUndefined();
      expect(Object.keys(plain)).not.toContain('statusCounts');
    });

    it('counts items per column, including empty columns, on request', async () => {
      const board = await service.createBoard(alice, { name: 'Counted' });
      const [todo, doing] = board.columns;
      await service.createItem(alice, board.id, {
        columnId: todo.id,
        title: 'One',
      });
      await service.createItem(alice, board.id, {
        columnId: todo.id,
        title: 'Two',
      });
      await service.createItem(alice, board.id, {
        columnId: doing.id,
        title: 'Three',
      });

      const [entry] = (await service.listBoards(alice, { withCounts: true }))
        .boards;
      expect(entry.statusCounts).toEqual(
        board.columns.map(column => ({
          columnId: column.id,
          title: column.title,
          color: undefined,
          count: { [todo.id]: 2, [doing.id]: 1 }[column.id] ?? 0,
        })),
      );
    });

    it('excludes archived items from the counts', async () => {
      const board = await service.createBoard(alice, { name: 'Counted' });
      const column = board.columns[0];
      await service.createItem(alice, board.id, {
        columnId: column.id,
        title: 'Kept',
      });
      const gone = await service.createItem(alice, board.id, {
        columnId: column.id,
        title: 'Archived',
      });
      await service.deleteItem(alice, board.id, gone.id);

      const [entry] = (await service.listBoards(alice, { withCounts: true }))
        .boards;
      expect(entry.statusCounts?.[0]).toMatchObject({
        columnId: column.id,
        count: 1,
      });
    });

    it('never counts a board the caller cannot read', async () => {
      const secret = await service.createBoard(bob, { name: 'Secret' });
      await service.createItem(bob, secret.id, {
        columnId: secret.columns[0].id,
        title: 'Hidden',
      });
      const mine = await service.createBoard(alice, { name: 'Mine' });

      const { boards: list } = await service.listBoards(alice, {
        withCounts: true,
      });
      expect(list.map(board => board.id)).toEqual([mine.id]);
      expect(JSON.stringify(list)).not.toContain(secret.columns[0].id);
    });

    it('reports a board with no items as all-zero counts', async () => {
      const board = await service.createBoard(alice, { name: 'Empty' });
      const [entry] = (await service.listBoards(alice, { withCounts: true }))
        .boards;
      expect(entry.statusCounts).toHaveLength(board.columns.length);
      expect(entry.statusCounts?.every(count => count.count === 0)).toBe(true);
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

    it('archives a board, keeping admin read access via the direct link', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-write',
      });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await service.addComment(alice, board.id, item.id, 'hello');
      await service.deleteBoard(alice, board.id);

      // hidden from every listing, but the admin can still open it read-only
      expect((await service.listBoards(alice)).boards).toHaveLength(0);
      const archived = await service.getBoard(alice, board.id);
      expect(archived.archivedAt).toBeDefined();
      expect(archived.archivedBy).toBe('user:default/alice');
      expect(await service.listItems(alice, board.id)).toHaveLength(1);

      // non-admins lose access entirely, even with logged-in-write visibility
      await expect(service.getBoard(bob, board.id)).rejects.toThrow(
        /not found/,
      );
      await expect(service.listItems(bob, board.id)).rejects.toThrow(
        /not found/,
      );

      // all writes fail, including for the admin
      await expect(
        service.createItem(alice, board.id, {
          columnId: board.columns[0].id,
          title: 'Nope',
        }),
      ).rejects.toThrow(/archived and read-only/);
      await expect(
        service.updateBoard(alice, board.id, { name: 'New' }),
      ).rejects.toThrow(/archived and read-only/);
      await expect(
        service.addPermission(alice, board.id, {
          principalRef: 'user:default/bob',
          level: 'read',
        }),
      ).rejects.toThrow(/archived and read-only/);
      await expect(service.deleteBoard(alice, board.id)).rejects.toThrow(
        /archived and read-only/,
      );
    });

    it('unarchives a board back to its normal state', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-write',
      });
      await expect(service.unarchiveBoard(alice, board.id)).rejects.toThrow(
        /not archived/,
      );
      await service.deleteBoard(alice, board.id);
      // non-admins cannot even see the archived board
      await expect(service.unarchiveBoard(bob, board.id)).rejects.toThrow(
        /not found/,
      );
      await service.unarchiveBoard(alice, board.id);
      const restored = await service.getBoard(alice, board.id);
      expect(restored.archivedAt).toBeUndefined();
      expect((await service.listBoards(alice)).boards).toHaveLength(1);
      // writable again
      await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Back in business',
      });
    });

    it('hard-deletes only archived boards, cascading all data', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await service.addComment(alice, board.id, item.id, 'hello');
      await service.setWatchItem(alice, board.id, item.id, true);
      await service.setWatchBoard(alice, board.id, true);

      await expect(service.hardDeleteBoard(alice, board.id)).rejects.toThrow(
        /Only archived boards/,
      );
      await service.deleteBoard(alice, board.id);
      await service.hardDeleteBoard(alice, board.id);

      await expect(service.getBoard(alice, board.id)).rejects.toThrow(
        /not found/,
      );
      expect(await knex('items')).toHaveLength(0);
      expect(await knex('comments')).toHaveLength(0);
      expect(await knex('comment_versions')).toHaveLength(0);
      expect(await knex('changes')).toHaveLength(0);
      expect(await knex('watches')).toHaveLength(0);
    });

    it('purges only boards archived before the cutoff', async () => {
      const oldBoard = await service.createBoard(alice, { name: 'Old' });
      const newBoard = await service.createBoard(alice, { name: 'New' });
      await service.deleteBoard(alice, oldBoard.id);
      await service.deleteBoard(alice, newBoard.id);
      // backdate the first archival beyond the retention window
      const past = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await knex('boards')
        .where('id', oldBoard.id)
        .update({ archived_at: past.toISOString() });
      const purged = await service.purgeArchivedBoards(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      );
      expect(purged).toBe(1);
      expect(await knex('boards').where('id', oldBoard.id)).toHaveLength(0);
      expect(await knex('boards').where('id', newBoard.id)).toHaveLength(1);
    });

    it('manages the entity reference list', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      expect(board.entityRefs).toEqual([]);
      const assigned = await service.updateBoard(alice, board.id, {
        entityRefs: [
          'system:default/payments',
          'group:default/team-a',
          'system:default/payments',
        ],
      });
      expect(assigned.entityRefs).toEqual([
        'group:default/team-a',
        'system:default/payments',
      ]);
      const cleared = await service.updateBoard(alice, board.id, {
        entityRefs: [],
      });
      expect(cleared.entityRefs).toEqual([]);
      await expect(
        service.updateBoard(alice, board.id, { entityRefs: ['not a ref !'] }),
      ).rejects.toThrow(/Invalid entity ref/);
    });

    it('tracks per-user favorites', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        visibility: 'logged-in-read',
      });
      await service.setFavorite(alice, board.id, true);
      expect(
        (await service.listBoards(alice, { favoritesOnly: true })).boards.map(
          b => b.id,
        ),
      ).toEqual([board.id]);
      expect(
        (await service.listBoards(bob, { favoritesOnly: true })).boards,
      ).toHaveLength(0);
      await service.setFavorite(alice, board.id, false);
      expect(
        (await service.listBoards(alice, { favoritesOnly: true })).boards,
      ).toHaveLength(0);
    });
  });

  describe('visibility parity', () => {
    // The listing decides what a caller may see in SQL, while every
    // single-board path decides it with computeEffectiveLevel. Two
    // implementations of one rule drift silently, so this pins them to
    // each other over the whole matrix of visibilities and grants.
    const GRANTS = {
      none: undefined,
      direct: { principalRef: 'user:default/carol', level: 'read' as const },
      group: { principalRef: 'group:default/team-a', level: 'write' as const },
    };

    it('lists exactly the boards the effective level computation grants', async () => {
      const boards: Array<{ id: string; visibility: BoardVisibility }> = [];
      for (const visibility of ALL_VISIBILITIES) {
        for (const grant of Object.values(GRANTS)) {
          // bob owns every board, so alice and carol only ever reach one
          // through its visibility or through the grant under test
          const board = await service.createBoard(bob, {
            name: `${visibility}-${grant?.principalRef ?? 'none'}`,
            visibility,
          });
          if (grant) {
            await service.addPermission(bob, board.id, grant);
          }
          boards.push({ id: board.id, visibility });
        }
      }

      const entriesByBoard = new Map(
        await Promise.all(
          boards.map(
            async board =>
              [
                board.id,
                (
                  await service.listPermissions(bob, board.id)
                ).map(entry => ({
                  principalRef: entry.principalRef,
                  level: entry.level,
                })),
              ] as const,
          ),
        ),
      );

      for (const [name, principal] of Object.entries({
        alice,
        carol,
        syncService,
        anonymous,
      })) {
        const expected = boards
          .filter(
            board =>
              computeEffectiveLevel({
                principal,
                visibility: board.visibility,
                entries: entriesByBoard.get(board.id) ?? [],
              }) !== undefined,
          )
          .map(board => board.id)
          .sort();
        const listed = (await service.listBoards(principal)).boards
          .map(board => board.id)
          .sort();
        // the principal's name rides along so a failure says who
        expect({ principal: name, listed }).toEqual({
          principal: name,
          listed: expected,
        });
      }
    });

    it('reports the level the effective level computation computes', async () => {
      const board = await service.createBoard(bob, {
        name: 'Public and granted',
        visibility: 'public-read',
      });
      await service.addPermission(bob, board.id, {
        principalRef: 'group:default/team-a',
        level: 'write',
      });
      const [entry] = (await service.listBoards(alice)).boards;
      expect(entry.access).toBe('write');
    });
  });

  describe('board listing filters and paging', () => {
    /** Boards alice can read, named as the tests refer to them. */
    async function seed(names: string[]) {
      const created = [];
      for (const name of names) {
        created.push(await service.createBoard(alice, { name }));
      }
      return created;
    }

    it('matches the search term against the name, case-insensitively', async () => {
      await seed(['Payments', 'payment reconciliation', 'Shipping']);
      const { boards, total } = await service.listBoards(alice, {
        search: 'PAY',
      });
      expect(boards.map(board => board.name)).toEqual([
        'Payments',
        'payment reconciliation',
      ]);
      expect(total).toBe(2);
    });

    it('treats a whitespace-only search as no search at all', async () => {
      await seed(['One', 'Two']);
      const { boards } = await service.listBoards(alice, { search: '   ' });
      expect(boards).toHaveLength(2);
    });

    it('matches LIKE wildcards literally', async () => {
      await seed(['100% done', 'Nothing like it']);
      const { boards } = await service.listBoards(alice, { search: '100%' });
      expect(boards.map(board => board.name)).toEqual(['100% done']);

      // an unescaped _ would match any single character
      const underscore = await service.listBoards(alice, { search: 'n_thing' });
      expect(underscore.boards).toHaveLength(0);
    });

    it('filters by creator', async () => {
      const mine = await service.createBoard(alice, { name: 'Mine' });
      const theirs = await service.createBoard(bob, {
        name: 'Theirs',
        visibility: 'logged-in-read',
      });
      const { boards } = await service.listBoards(alice, {
        createdBy: 'user:default/alice',
      });
      expect(boards.map(board => board.id)).toEqual([mine.id]);
      expect(
        (await service.listBoards(alice, { createdBy: 'user:default/bob' }))
          .boards,
      ).toHaveLength(1);
      expect(theirs.createdBy).toBe('user:default/bob');
    });

    it('combines filters with AND', async () => {
      const wanted = await service.createBoard(alice, {
        name: 'Payments board',
        entityRefs: ['system:default/payments'],
      });
      await service.createBoard(alice, { name: 'Payments without entity' });
      await service.createBoard(alice, {
        name: 'Other',
        entityRefs: ['system:default/payments'],
      });
      const { boards } = await service.listBoards(alice, {
        search: 'payments',
        entityRef: 'system:default/payments',
      });
      expect(boards.map(board => board.id)).toEqual([wanted.id]);
    });

    it('pages through the listing, reporting the total of matches', async () => {
      const created = await seed(['A', 'B', 'C', 'D', 'E']);
      const page = await service.listBoards(alice, { limit: 2, offset: 2 });
      expect(page.boards.map(board => board.name)).toEqual(['C', 'D']);
      expect(page).toMatchObject({ total: 5, limit: 2, offset: 2 });
      expect(created).toHaveLength(5);
    });

    it('applies access before cutting the page', async () => {
      // bob's private boards are interleaved by name with alice's
      for (const name of ['A', 'C', 'E']) {
        await service.createBoard(bob, { name });
      }
      for (const name of ['B', 'D', 'F']) {
        await service.createBoard(alice, { name });
      }
      const page = await service.listBoards(alice, { limit: 2 });
      expect(page.boards.map(board => board.name)).toEqual(['B', 'D']);
      expect(page.total).toBe(3);
    });

    it('pages boards of equal name without repeating or skipping one', async () => {
      await seed(['Same', 'Same', 'Same', 'Same']);
      const first = await service.listBoards(alice, { limit: 2, offset: 0 });
      const second = await service.listBoards(alice, { limit: 2, offset: 2 });
      const ids = [...first.boards, ...second.boards].map(board => board.id);
      expect(new Set(ids).size).toBe(4);
    });

    it('returns every match and no paging fields without a limit', async () => {
      await seed(['A', 'B', 'C']);
      const result = await service.listBoards(alice);
      expect(result.boards).toHaveLength(3);
      expect(result).toEqual({ boards: result.boards, total: 3 });
    });

    it('counts only the returned page when counts are requested', async () => {
      const boards = await seed(['A', 'B']);
      await service.createItem(alice, boards[0].id, {
        columnId: (await service.getBoard(alice, boards[0].id)).columns[0].id,
        title: 'One',
      });
      const page = await service.listBoards(alice, {
        limit: 1,
        withCounts: true,
      });
      expect(page.boards).toHaveLength(1);
      expect(page.boards[0].statusCounts?.[0].count).toBe(1);
    });

    it('keeps favorites a filter of its own', async () => {
      const [kept, other] = await seed(['Kept', 'Other']);
      await service.setFavorite(alice, kept.id, true);
      const { boards, total } = await service.listBoards(alice, {
        favoritesOnly: true,
      });
      expect(boards.map(board => board.id)).toEqual([kept.id]);
      expect(total).toBe(1);
      expect(other.id).not.toBe(kept.id);
    });
  });

  describe('board filter options', () => {
    it('offers the entities and creators of the boards the caller can read', async () => {
      await service.createBoard(alice, {
        name: 'Mine',
        entityRefs: ['system:default/payments'],
      });
      const shared = await service.createBoard(bob, {
        name: 'Shared',
        entityRefs: ['component:default/service-a'],
        visibility: 'logged-in-read',
      });

      const options = await service.listFilterOptions(alice);
      expect(options).toEqual({
        total: 2,
        entityRefs: ['component:default/service-a', 'system:default/payments'],
        creators: ['user:default/alice', 'user:default/bob'],
      });
      expect(shared.createdBy).toBe('user:default/bob');
    });

    it('never discloses an inaccessible board, its entities, or its creator', async () => {
      await service.createBoard(bob, {
        name: 'Secret',
        entityRefs: ['component:default/secret'],
      });
      await service.createBoard(alice, { name: 'Mine' });

      const options = await service.listFilterOptions(alice);
      expect(options.total).toBe(1);
      expect(options.entityRefs).toEqual([]);
      expect(options.creators).toEqual(['user:default/alice']);
    });

    it('drops an archived board from the options', async () => {
      const gone = await service.createBoard(alice, {
        name: 'Gone',
        entityRefs: ['component:default/old'],
      });
      await service.createBoard(alice, {
        name: 'Kept',
        entityRefs: ['component:default/new'],
      });
      await service.deleteBoard(alice, gone.id);

      const options = await service.listFilterOptions(alice);
      expect(options).toEqual({
        total: 1,
        entityRefs: ['component:default/new'],
        creators: ['user:default/alice'],
      });
    });

    it('offers nothing to a caller with no readable boards', async () => {
      await service.createBoard(bob, { name: 'Theirs' });
      expect(await service.listFilterOptions(carol)).toEqual({
        total: 0,
        entityRefs: [],
        creators: [],
      });
    });
  });

  describe('duplicate board', () => {
    it('copies items into the matching columns when requested', async () => {
      const board = await service.createBoard(alice, { name: 'Source' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[1].id,
        title: 'Copied task',
        assignees: ['user:default/bob'],
        tags: ['bug'],
      });
      await service.updateItem(alice, board.id, item.id, {
        dueDate: '2026-09-04',
        description: 'details',
      });
      await service.addComment(alice, board.id, item.id, 'not copied');
      const archived = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Archived source item',
      });
      await service.deleteItem(alice, board.id, archived.id);

      const copy = await service.duplicateBoard(alice, board.id, {
        copyColumns: true,
        copyItems: true,
        copyPermissions: false,
      });
      const items = await service.listItems(alice, copy.id);
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Copied task');
      expect(items[0].columnId).toBe(copy.columns[1].id);
      expect(items[0].assignees).toEqual(['user:default/bob']);
      expect(items[0].tags).toEqual(['bug']);
      expect(items[0].dueDate).toBe('2026-09-04');
      expect(items[0].description).toBe('details');
      // creation is the only history; comments are not copied
      const timeline = await service.getTimeline(alice, copy.id, items[0].id);
      expect(timeline.filter(entry => entry.kind === 'comment')).toHaveLength(
        0,
      );
    });

    it('rejects copying items without columns', async () => {
      const board = await service.createBoard(alice, { name: 'Source' });
      await expect(
        service.duplicateBoard(alice, board.id, {
          copyColumns: false,
          copyItems: true,
          copyPermissions: false,
        }),
      ).rejects.toThrow(/together with columns/);
    });

    it('copies entity references when requested', async () => {
      const board = await service.createBoard(alice, {
        name: 'Source',
        entityRefs: ['component:default/svc', 'group:default/team-a'],
      });
      const withEntities = await service.duplicateBoard(alice, board.id, {
        copyColumns: false,
        copyEntities: true,
        copyPermissions: false,
      });
      expect(withEntities.entityRefs).toEqual([
        'component:default/svc',
        'group:default/team-a',
      ]);
      const without = await service.duplicateBoard(alice, board.id, {
        copyColumns: false,
        copyPermissions: false,
      });
      expect(without.entityRefs).toEqual([]);
    });

    it('copies columns with colors, never items', async () => {
      const board = await service.createBoard(alice, { name: 'Source' });
      await service.updateColumn(alice, board.id, board.columns[0].id, {
        color: 'green',
      });
      await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Not copied',
      });
      const copy = await service.duplicateBoard(alice, board.id, {
        copyColumns: true,
        copyPermissions: false,
      });
      expect(copy.name).toBe('Source (copy)');
      expect(copy.access).toBe('admin');
      expect(copy.visibility).toBe('private');
      expect(copy.columns.map(column => column.title)).toEqual(
        board.columns.map(column => column.title),
      );
      expect(copy.columns[0].color).toBe('green');
      expect(await service.listItems(alice, copy.id)).toHaveLength(0);
    });

    it('copies share settings for source admins', async () => {
      const board = await service.createBoard(alice, {
        name: 'Source',
        visibility: 'logged-in-read',
      });
      await service.addPermission(alice, board.id, {
        principalRef: 'user:default/bob',
        level: 'write',
      });
      const copy = await service.duplicateBoard(alice, board.id, {
        name: 'Clone',
        copyColumns: false,
        copyPermissions: true,
      });
      expect(copy.visibility).toBe('logged-in-read');
      const permissions = await service.listPermissions(alice, copy.id);
      expect(
        permissions.map(entry => `${entry.principalRef}:${entry.level}`).sort(),
      ).toEqual(['user:default/alice:admin', 'user:default/bob:write']);
    });

    it('downgrades other admins to write on the copy', async () => {
      const board = await service.createBoard(alice, { name: 'Source' });
      await service.addPermission(alice, board.id, {
        principalRef: 'user:default/bob',
        level: 'admin',
      });
      await service.addPermission(alice, board.id, {
        principalRef: 'user:default/carol',
        level: 'read',
      });
      // bob (also an admin of the source) duplicates it with sharing
      const copy = await service.duplicateBoard(bob, board.id, {
        copyColumns: false,
        copyPermissions: true,
      });
      const permissions = await service.listPermissions(bob, copy.id);
      expect(
        permissions.map(entry => `${entry.principalRef}:${entry.level}`).sort(),
      ).toEqual([
        'user:default/alice:write',
        'user:default/bob:admin',
        'user:default/carol:read',
      ]);
    });

    it('rejects share-settings copy without source admin', async () => {
      const board = await service.createBoard(alice, {
        name: 'Source',
        visibility: 'logged-in-write',
      });
      await expect(
        service.duplicateBoard(bob, board.id, {
          copyColumns: true,
          copyPermissions: true,
        }),
      ).rejects.toThrow(/requires admin/);
      // plain duplication with columns is fine for a non-admin
      const copy = await service.duplicateBoard(bob, board.id, {
        copyColumns: true,
        copyPermissions: false,
      });
      expect(copy.access).toBe('admin');
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

    it('sets and clears column colors from the palette only', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const column = board.columns[0];
      const colored = await service.updateColumn(alice, board.id, column.id, {
        color: 'green',
      });
      expect(colored.color).toBe('green');
      await expect(
        service.updateColumn(alice, board.id, column.id, { color: 'pink' }),
      ).rejects.toThrow(/Invalid column color/);
      const cleared = await service.updateColumn(alice, board.id, column.id, {
        color: null,
      });
      expect(cleared.color).toBeUndefined();
      const added = await service.addColumn(alice, board.id, {
        title: 'Review',
        color: 'purple',
      });
      expect(added.color).toBe('purple');
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
        tags: ['bug'],
      });
      expect(item.createdBy).toBe('user:default/alice');
      expect(item.createdAt).toBeTruthy();
      expect(item.assignees.sort()).toEqual([
        'text:Jane (agency)',
        'user:default/bob',
      ]);
      expect(item.tags).toEqual(['bug']);
    });

    it('lists my items across readable boards only', async () => {
      const own = await service.createBoard(alice, { name: 'A Own' });
      const shared = await service.createBoard(bob, {
        name: 'B Shared',
        visibility: 'logged-in-read',
      });
      const hidden = await service.createBoard(bob, { name: 'C Hidden' });

      const mine = await service.createItem(alice, own.id, {
        columnId: own.columns[0].id,
        title: 'Direct',
        assignees: ['user:default/alice'],
      });
      await service.createItem(bob, shared.id, {
        columnId: shared.columns[0].id,
        title: 'Via group',
        assignees: ['group:default/team-a'],
      });
      // assigned to alice on a board she cannot read: must not leak
      await service.createItem(bob, hidden.id, {
        columnId: hidden.columns[0].id,
        title: 'Invisible',
        assignees: ['user:default/alice'],
      });
      // assigned to someone else: not hers
      await service.createItem(alice, own.id, {
        columnId: own.columns[0].id,
        title: 'Not mine',
        assignees: ['user:default/bob'],
      });
      // archived assignment disappears
      const archived = await service.createItem(alice, own.id, {
        columnId: own.columns[0].id,
        title: 'Archived',
        assignees: ['user:default/alice'],
      });
      await service.deleteItem(alice, own.id, archived.id);

      const entries = await service.listMyItems(alice);
      expect(entries.map(entry => entry.item.title)).toEqual([
        'Direct',
        'Via group',
      ]);
      expect(entries[0].boardName).toBe('A Own');
      expect(entries[0].boardId).toBe(own.id);
      expect(entries[0].columnTitle).toBe(own.columns[0].title);
      expect(entries[0].item.id).toBe(mine.id);

      await expect(service.listMyItems(anonymous)).rejects.toThrow(
        /requires a logged-in user/,
      );
    });

    it('sets, tracks, and clears due dates', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      const withDue = await service.updateItem(alice, board.id, item.id, {
        dueDate: '2026-09-04',
      });
      expect(withDue.dueDate).toBe('2026-09-04');
      const cleared = await service.updateItem(alice, board.id, item.id, {
        dueDate: null,
      });
      expect(cleared.dueDate).toBeUndefined();
      const timeline = await service.getTimeline(alice, board.id, item.id);
      const dueChanges = timeline.filter(
        entry => entry.kind === 'change' && entry.change.field === 'dueDate',
      );
      expect(dueChanges).toHaveLength(2);
    });

    it('rejects invalid due dates', async () => {
      const board = await service.createBoard(alice, { name: 'B' });
      const item = await service.createItem(alice, board.id, {
        columnId: board.columns[0].id,
        title: 'Item',
      });
      await expect(
        service.updateItem(alice, board.id, item.id, {
          dueDate: '04.09.2026',
        }),
      ).rejects.toThrow(/Invalid due date/);
      await expect(
        service.updateItem(alice, board.id, item.id, {
          dueDate: '2026-02-30',
        }),
      ).rejects.toThrow(/Invalid due date/);
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
      await expect(service.deleteItem(bob, board.id, item.id)).rejects.toThrow(
        /requires 'write'/,
      );
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
      await expect(service.restoreItem(bob, board.id, item.id)).rejects.toThrow(
        /requires 'write'/,
      );
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
      expect(await knex('changes').where('item_id', oldItem.id)).toHaveLength(
        0,
      );
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

  describe('entity references', () => {
    it('reports entities referenced by any board, regardless of access', async () => {
      await service.createBoard(bob, {
        name: 'Private board of bob',
        entityRefs: ['component:default/payments'],
      });
      await expect(
        service.isEntityReferenced('component:default/payments'),
      ).resolves.toBe(true);
      await expect(
        service.isEntityReferenced('component:default/other'),
      ).resolves.toBe(false);
    });

    it('ignores archived boards until they are unarchived', async () => {
      const board = await service.createBoard(alice, {
        name: 'Board',
        entityRefs: ['component:default/payments'],
      });
      await service.deleteBoard(alice, board.id);
      await expect(
        service.isEntityReferenced('component:default/payments'),
      ).resolves.toBe(false);
      await service.unarchiveBoard(alice, board.id);
      await expect(
        service.isEntityReferenced('component:default/payments'),
      ).resolves.toBe(true);
    });
  });

  describe('catalog entity refresh hook', () => {
    const reportedRefs = () =>
      onEntityRefsChanged.mock.calls.map(call => [...call[0]].sort());

    it('reports the refs of a new board', async () => {
      await service.createBoard(alice, {
        name: 'B',
        entityRefs: ['component:default/a', 'component:default/b'],
      });
      expect(reportedRefs()).toEqual([
        ['component:default/a', 'component:default/b'],
      ]);
    });

    it('is silent for a board without entities', async () => {
      await service.createBoard(alice, { name: 'B' });
      expect(onEntityRefsChanged).not.toHaveBeenCalled();
    });

    it('reports both the old and the new refs on reassignment', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        entityRefs: ['component:default/a'],
      });
      onEntityRefsChanged.mockClear();
      await service.updateBoard(alice, board.id, {
        entityRefs: ['component:default/b'],
      });
      expect(reportedRefs()).toEqual([
        ['component:default/a', 'component:default/b'],
      ]);
    });

    it('reports on archive, unarchive, and permanent deletion', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        entityRefs: ['component:default/a'],
      });
      onEntityRefsChanged.mockClear();

      await service.deleteBoard(alice, board.id);
      expect(reportedRefs()).toEqual([['component:default/a']]);
      onEntityRefsChanged.mockClear();

      await service.unarchiveBoard(alice, board.id);
      expect(reportedRefs()).toEqual([['component:default/a']]);
      onEntityRefsChanged.mockClear();

      await service.deleteBoard(alice, board.id);
      onEntityRefsChanged.mockClear();
      await service.hardDeleteBoard(alice, board.id);
      expect(reportedRefs()).toEqual([['component:default/a']]);
    });

    it('reports the copied refs of a duplicated board', async () => {
      const board = await service.createBoard(alice, {
        name: 'B',
        entityRefs: ['component:default/a'],
      });
      onEntityRefsChanged.mockClear();
      await service.duplicateBoard(alice, board.id, {
        copyColumns: true,
        copyEntities: true,
        copyPermissions: false,
      });
      expect(reportedRefs()).toEqual([['component:default/a']]);
    });

    it('does not fail the board operation when the hook throws', async () => {
      onEntityRefsChanged.mockImplementation(() => {
        throw new Error('catalog unreachable');
      });
      const board = await service.createBoard(alice, {
        name: 'B',
        entityRefs: ['component:default/a'],
      });
      expect(board.entityRefs).toEqual(['component:default/a']);
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
        assignees: ['user:default/bob'],
      });
      const withDescription = await service.createItem(alice, board.id, {
        columnId,
        title: 'Improve docs',
        tags: ['docs'],
      });
      await service.updateItem(alice, board.id, withDescription.id, {
        description: 'covers the LOGIN flow',
        assignees: ['text:Jane'],
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

    it('requires all tags', async () => {
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
    });

    it('matches any of the requested assignees', async () => {
      const board = await seedFilterBoard();
      expect(
        (
          await service.listItems(alice, board.id, {
            assignees: ['user:default/bob'],
          })
        ).map(i => i.title),
      ).toEqual(['Fix login bug']);
      expect(
        (
          await service.listItems(alice, board.id, {
            assignees: ['user:default/bob', 'text:Jane'],
          })
        )
          .map(i => i.title)
          .sort(),
      ).toEqual(['Fix login bug', 'Improve docs']);
      expect(
        await service.listItems(alice, board.id, {
          assignees: ['user:default/carol'],
        }),
      ).toHaveLength(0);
    });

    it('intersects assignees with the other filters', async () => {
      const board = await seedFilterBoard();
      expect(
        (
          await service.listItems(alice, board.id, {
            tags: ['bug'],
            assignees: ['user:default/bob', 'text:Jane'],
          })
        ).map(i => i.title),
      ).toEqual(['Fix login bug']);
      expect(
        await service.listItems(alice, board.id, {
          tags: ['docs'],
          assignees: ['user:default/bob'],
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
          })
        ).map(i => i.title),
      ).toEqual(['Fix login bug']);
      expect(
        await service.listItems(alice, board.id, {
          text: 'login',
          tags: ['docs', 'bug'],
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
      expect(versions.map(v => v.text)).toEqual([
        'First **draft**',
        'Final text',
      ]);
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
      expect(recipientRefs(notifications.send.mock.calls[0][0])).toEqual([
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
      expect(recipientRefs(notifications.send.mock.calls[0][0])).toEqual([
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
      expect(recipientRefs(call)).toEqual(['user:default/carol']);
      expect(call.payload.title).toMatch(/mentioned/i);
      expect(call.payload.link).toContain(`item=${item.id}`);
    });

    it('mentioned watchers get exactly one notification, actors none', async () => {
      const { board, item } = await setupWatchedItem();
      await service.setWatchItem(carol, board.id, item.id, true);
      await service.addComment(
        alice,
        board.id,
        item.id,
        'fyi @carol and me @user:default/alice',
      );
      // carol: only the mention; alice: nothing despite self-mention
      expect(notifications.send).toHaveBeenCalledTimes(1);
      const call = notifications.send.mock.calls[0][0];
      expect(recipientRefs(call)).toEqual(['user:default/carol']);
      expect(call.payload.title).toMatch(/mentioned/i);
    });

    it('notifies mentions in description edits', async () => {
      const { board, item } = await setupWatchedItem();
      await service.updateItem(alice, board.id, item.id, {
        description: 'owned by @group:default/guests',
      });
      const mentionCall = notifications.send.mock.calls.find(
        ([options]) => options.payload.title === 'You were mentioned',
      );
      expect(mentionCall && recipientRefs(mentionCall[0])).toEqual([
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
