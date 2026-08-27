import { AuthService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { ConfigReader } from '@backstage/config';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { NotificationService } from '@backstage/plugin-notifications-node';
import { Knex } from 'knex';
import {
  entityField,
  readRemindersConfig,
  runReminder,
  ReminderConfig,
} from './reminders';
import { BoardsService } from './service/BoardsService';
import { alice, bob, createTestService, testLogger } from './service/testUtils';

function userEntity(
  name: string,
  options?: {
    labels?: Record<string, string>;
    groups?: string[];
  },
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'User',
    metadata: { name, namespace: 'default', labels: options?.labels ?? {} },
    relations: (options?.groups ?? []).map(group => ({
      type: 'memberOf',
      targetRef: group,
    })),
  };
}

function stubCatalog(users: Entity[]): CatalogService {
  return {
    getEntities: jest.fn().mockResolvedValue({ items: users }),
  } as unknown as CatalogService;
}

const auth = {
  getOwnServiceCredentials: jest
    .fn()
    .mockResolvedValue({ principal: { type: 'service' } }),
} as unknown as AuthService;

function reminder(overrides: Partial<ReminderConfig>): ReminderConfig {
  return {
    id: 'test',
    schedule: { frequency: { cron: '0 8 * * *' }, timeout: { minutes: 5 } },
    scope: 'all',
    grouping: 'combined',
    userFilter: {},
    excludeUsers: {},
    ...overrides,
  };
}

describe('readRemindersConfig', () => {
  it('parses entries with defaults and both schedule kinds', () => {
    const config = new ConfigReader({
      boards: {
        reminders: [
          {
            id: 'a',
            schedule: {
              frequency: { cron: '0 8 * * 1-5' },
              timeout: { minutes: 5 },
            },
          },
          {
            id: 'b',
            schedule: {
              frequency: { minutes: 10 },
              timeout: { minutes: 5 },
            },
            scope: 'overdue',
            grouping: 'per-board',
            excludeUsers: {
              'metadata.labels.boards/notifications': 'false',
            },
          },
        ],
      },
    });
    const parsed = readRemindersConfig(config);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      id: 'a',
      schedule: { frequency: { cron: '0 8 * * 1-5' } },
      scope: 'all',
      grouping: 'combined',
    });
    expect(parsed[1]).toMatchObject({
      id: 'b',
      schedule: {
        frequency: expect.anything(),
        timeout: expect.anything(),
      },
      scope: 'overdue',
      grouping: 'per-board',
      excludeUsers: { 'metadata.labels.boards/notifications': 'false' },
    });
  });

  it('rejects invalid entries', () => {
    expect(() =>
      readRemindersConfig(
        new ConfigReader({ boards: { reminders: [{ id: 'x' }] } }),
      ),
    ).toThrow(/missing 'schedule'/);
    expect(() =>
      readRemindersConfig(
        new ConfigReader({
          boards: {
            reminders: [{ id: 'x', schedule: { frequency: 'nope' } }],
          },
        }),
      ),
    ).toThrow(/invalid 'schedule'/);
    expect(() =>
      readRemindersConfig(
        new ConfigReader({
          boards: {
            reminders: [
              {
                id: 'x',
                schedule: {
                  frequency: { cron: '* * * * *' },
                  timeout: { minutes: 5 },
                },
                scope: 'nope',
              },
            ],
          },
        }),
      ),
    ).toThrow(/invalid scope/);
  });
});

describe('entityField', () => {
  const entity = userEntity('jane', {
    labels: { 'boards/notifications': 'false', team: 'payments' },
  });

  it('resolves plain and slash-containing label paths', () => {
    expect(entityField(entity, 'metadata.name')).toBe('jane');
    expect(entityField(entity, 'metadata.labels.team')).toBe('payments');
    expect(entityField(entity, 'metadata.labels.boards/notifications')).toBe(
      'false',
    );
    expect(entityField(entity, 'metadata.labels.missing')).toBeUndefined();
  });
});

describe('runReminder', () => {
  let knex: Knex;
  let service: BoardsService;
  let notifications: { send: jest.Mock };

  beforeEach(async () => {
    ({ knex, service, notifications } = await createTestService());
  });

  afterEach(async () => {
    await knex.destroy();
  });

  async function seed() {
    const board = await service.createBoard(alice, {
      name: 'Alpha',
      visibility: 'logged-in-read',
    });
    const other = await service.createBoard(bob, {
      name: 'Beta',
      visibility: 'logged-in-read',
    });
    const past = '2020-01-01';
    const future = '2999-12-31';
    const overdue = await service.createItem(alice, board.id, {
      columnId: board.columns[0].id,
      title: 'Overdue task',
      assignees: ['user:default/alice'],
    });
    await service.updateItem(alice, board.id, overdue.id, { dueDate: past });
    const upcoming = await service.createItem(alice, board.id, {
      columnId: board.columns[0].id,
      title: 'Future task',
      assignees: ['user:default/alice'],
    });
    await service.updateItem(alice, board.id, upcoming.id, {
      dueDate: future,
    });
    await service.createItem(bob, other.id, {
      columnId: other.columns[0].id,
      title: 'Group task',
      assignees: ['group:default/team-a'],
    });
    return { board, other };
  }

  it('sends one combined message per user, honoring the scope', async () => {
    await seed();
    const catalog = stubCatalog([
      userEntity('alice', { groups: ['group:default/team-a'] }),
      userEntity('bob'),
    ]);
    // clear watcher notifications produced during seeding
    notifications.send.mockClear();

    await runReminder({
      reminder: reminder({ scope: 'overdue' }),
      service,
      catalog,
      auth,
      notifications: notifications as unknown as NotificationService,
      logger: testLogger,
    });

    // bob has no overdue items -> only alice is notified, once
    expect(notifications.send).toHaveBeenCalledTimes(1);
    const call = notifications.send.mock.calls[0][0];
    expect(call.recipients).toEqual({
      type: 'entity',
      entityRef: ['user:default/alice'],
    });
    expect(call.payload.title).toContain('1 overdue');
    expect(call.payload.description).toContain('Overdue task');
    expect(call.payload.description).not.toContain('Future task');
    expect(call.payload.link).toBe('/boards/my-items');
  });

  it('sends per-board messages including group assignments', async () => {
    await seed();
    const catalog = stubCatalog([
      userEntity('alice', { groups: ['group:default/team-a'] }),
    ]);
    notifications.send.mockClear();

    await runReminder({
      reminder: reminder({ grouping: 'per-board', scope: 'all' }),
      service,
      catalog,
      auth,
      notifications: notifications as unknown as NotificationService,
      logger: testLogger,
    });

    // alice has items on Alpha (2) and Beta (1, via group) -> 2 messages
    expect(notifications.send).toHaveBeenCalledTimes(2);
    const titles = notifications.send.mock.calls.map(
      call => call[0].payload.title,
    );
    expect(titles.some(title => title.includes('on Alpha'))).toBe(true);
    expect(titles.some(title => title.includes('on Beta'))).toBe(true);
  });

  it('skips users excluded by label', async () => {
    await seed();
    const catalog = stubCatalog([
      userEntity('alice', {
        groups: ['group:default/team-a'],
        labels: { 'boards/notifications': 'false' },
      }),
    ]);
    notifications.send.mockClear();

    await runReminder({
      reminder: reminder({
        excludeUsers: { 'metadata.labels.boards/notifications': 'false' },
      }),
      service,
      catalog,
      auth,
      notifications: notifications as unknown as NotificationService,
      logger: testLogger,
    });

    expect(notifications.send).not.toHaveBeenCalled();
  });
});
