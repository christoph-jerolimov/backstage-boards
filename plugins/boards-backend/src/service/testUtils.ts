import { LoggerService } from '@backstage/backend-plugin-api';
import {
  NotificationSendOptions,
  NotificationService,
} from '@backstage/plugin-notifications-node';
import { SignalsService } from '@backstage/plugin-signals-node';
import knexFactory, { Knex } from 'knex';
import { applyDatabaseMigrations } from '../database/migrations';
import { BoardsPrincipal } from './access';
import { BoardsService, BoardsServiceOptions } from './BoardsService';

export const testLogger: LoggerService = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => testLogger,
};

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

/** The bit of a better-sqlite3 connection the pool hook reaches for. */
type SqliteConnection = { pragma(source: string): unknown };

export async function createTestKnex(): Promise<Knex> {
  const knex = knexFactory({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate: (
        conn: SqliteConnection,
        done: (err: Error | null, conn: SqliteConnection) => void,
      ) => {
        conn.pragma('foreign_keys = ON');
        done(null, conn);
      },
    },
  });
  await applyDatabaseMigrations(knex);
  return knex;
}

/**
 * The entities a notification was addressed to. Recipients are a union, so
 * a broadcast — which the boards service never sends — fails the test here
 * rather than at an assertion further down.
 */
export function recipientRefs(options: NotificationSendOptions): string[] {
  if (options.recipients.type !== 'entity') {
    throw new Error('Expected a notification addressed to entities');
  }
  const { entityRef } = options.recipients;
  return Array.isArray(entityRef) ? entityRef : [entityRef];
}

/** The notification and signal services, mocked so tests can assert on them. */
export interface TestNotifications extends NotificationService {
  send: jest.MockedFunction<NotificationService['send']>;
}

export interface TestSignals extends SignalsService {
  publish: jest.MockedFunction<SignalsService['publish']>;
}

/** A service wired to an in-memory database, with its collaborators mocked. */
export interface TestService {
  knex: Knex;
  service: BoardsService;
  notifications: TestNotifications;
  signals: TestSignals;
  onEntityRefsChanged: jest.MockedFunction<
    NonNullable<BoardsServiceOptions['onEntityRefsChanged']>
  >;
}

export async function createTestService(): Promise<TestService> {
  const knex = await createTestKnex();
  const notifications: TestNotifications = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  const signals: TestSignals = {
    publish: jest.fn().mockResolvedValue(undefined),
  };
  const onEntityRefsChanged = jest.fn();
  const service = new BoardsService({
    knex,
    logger: testLogger,
    notifications,
    signals,
    onEntityRefsChanged,
  });
  return { knex, service, notifications, signals, onEntityRefsChanged };
}
