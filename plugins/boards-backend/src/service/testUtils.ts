import { LoggerService } from '@backstage/backend-plugin-api';
import { NotificationService } from '@backstage/plugin-notifications-node';
import knexFactory, { Knex } from 'knex';
import { applyDatabaseMigrations } from '../database/migrations';
import { BoardsPrincipal } from './access';
import { BoardsService } from './BoardsService';

export const testLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: function child() {
    return this;
  },
} as unknown as LoggerService;

export const alice: BoardsPrincipal = {
  type: 'user',
  userRef: 'user:default/alice',
  ownershipRefs: ['user:default/alice', 'group:default/team-a'],
};

export const bob: BoardsPrincipal = {
  type: 'user',
  userRef: 'user:default/bob',
  ownershipRefs: ['user:default/bob', 'group:default/team-b'],
};

export const carol: BoardsPrincipal = {
  type: 'user',
  userRef: 'user:default/carol',
  ownershipRefs: ['user:default/carol'],
};

export const syncService: BoardsPrincipal = {
  type: 'service',
  subject: 'external:github-sync',
};

export const anonymous: BoardsPrincipal = { type: 'anonymous' };

export async function createTestKnex(): Promise<Knex> {
  const knex = knexFactory({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
        conn.pragma('foreign_keys = ON');
        done(null, conn);
      },
    },
  });
  await applyDatabaseMigrations(knex);
  return knex;
}

export async function createTestService(): Promise<{
  knex: Knex;
  service: BoardsService;
  notifications: { send: jest.Mock };
  signals: { publish: jest.Mock };
}> {
  const knex = await createTestKnex();
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };
  const signals = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new BoardsService({
    knex,
    logger: testLogger,
    notifications: notifications as unknown as NotificationService,
    signals: signals as any,
  });
  return { knex, service, notifications, signals };
}
