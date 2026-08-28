import {
  AuthService,
  LoggerService,
  readSchedulerServiceTaskScheduleDefinitionFromConfig,
  RootConfigService,
  SchedulerService,
  SchedulerServiceTaskScheduleDefinition,
} from '@backstage/backend-plugin-api';
import {
  Entity,
  RELATION_MEMBER_OF,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { NotificationService } from '@backstage/plugin-notifications-node';
import { dueState, MyBoardItem } from '@internal/plugin-boards-common';
import { BoardsService } from './service/BoardsService';

export const REMINDER_SCOPES = [
  'all',
  'with-due-date',
  'due-today',
  'overdue',
] as const;
export type ReminderScope = (typeof REMINDER_SCOPES)[number];

export const REMINDER_GROUPINGS = ['combined', 'per-board'] as const;
export type ReminderGrouping = (typeof REMINDER_GROUPINGS)[number];

function isReminderScope(value: string): value is ReminderScope {
  return REMINDER_SCOPES.some(scope => scope === value);
}

function isReminderGrouping(value: string): value is ReminderGrouping {
  return REMINDER_GROUPINGS.some(grouping => grouping === value);
}

export interface ReminderConfig {
  id: string;
  /** Standard Backstage scheduler configuration. */
  schedule: SchedulerServiceTaskScheduleDefinition;
  scope: ReminderScope;
  grouping: ReminderGrouping;
  userFilter: Record<string, string>;
  excludeUsers: Record<string, string>;
}

/** Reads and validates the `boards.reminders` configuration array. */
export function readRemindersConfig(
  config: RootConfigService,
): ReminderConfig[] {
  const reminders = config.getOptionalConfigArray('boards.reminders') ?? [];
  const result: ReminderConfig[] = [];
  const seen = new Set<string>();
  for (const entry of reminders) {
    const id = entry.getString('id');
    if (seen.has(id)) {
      throw new Error(`Duplicate boards.reminders id '${id}'`);
    }
    seen.add(id);
    const scheduleConfig = entry.getOptionalConfig('schedule');
    if (!scheduleConfig) {
      throw new Error(
        `boards.reminders '${id}' is missing 'schedule' (standard Backstage scheduler configuration)`,
      );
    }
    let schedule: SchedulerServiceTaskScheduleDefinition;
    try {
      schedule =
        readSchedulerServiceTaskScheduleDefinitionFromConfig(scheduleConfig);
    } catch (error) {
      throw new Error(
        `boards.reminders '${id}' has an invalid 'schedule': ${error}`,
      );
    }
    const scope = entry.getOptionalString('scope') ?? 'all';
    if (!isReminderScope(scope)) {
      throw new Error(
        `boards.reminders '${id}' has invalid scope '${scope}' (expected one of ${REMINDER_SCOPES.join(
          ', ',
        )})`,
      );
    }
    const grouping = entry.getOptionalString('grouping') ?? 'combined';
    if (!isReminderGrouping(grouping)) {
      throw new Error(
        `boards.reminders '${id}' has invalid grouping '${grouping}' (expected one of ${REMINDER_GROUPINGS.join(
          ', ',
        )})`,
      );
    }
    // read as raw JSON: field names may contain dots, which the config
    // reader would otherwise interpret as nested paths
    const readRecord = (key: string): Record<string, string> => {
      const raw = entry.getOptional(key);
      if (raw === undefined) {
        return {};
      }
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error(
          `boards.reminders '${id}' has invalid '${key}', expected an object of field/value pairs`,
        );
      }
      return Object.fromEntries(
        Object.entries(raw).map(([field, value]) => [field, String(value)]),
      );
    };
    result.push({
      id,
      schedule,
      scope,
      grouping,
      userFilter: readRecord('userFilter'),
      excludeUsers: readRecord('excludeUsers'),
    });
  }
  return result;
}

/**
 * Resolves a dotted path in an entity. Label and annotation keys may
 * themselves contain dots or slashes, so when descending fails the
 * remaining path is tried as one literal key (handles e.g.
 * `metadata.labels.boards/notifications`).
 */
export function entityField(entity: Entity, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = entity;
  for (let i = 0; i < segments.length; i++) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    const record = current as Record<string, unknown>;
    const segment = segments[i];
    if (segment in record) {
      current = record[segment];
      continue;
    }
    const rest = segments.slice(i).join('.');
    return rest in record ? record[rest] : undefined;
  }
  return current;
}

function matchesExclude(
  entity: Entity,
  exclude: Record<string, string>,
): boolean {
  return Object.entries(exclude).some(
    ([path, value]) => String(entityField(entity, path)) === value,
  );
}

function scopeFilter(scope: ReminderScope) {
  return (entry: MyBoardItem): boolean => {
    const due = entry.item.dueDate;
    switch (scope) {
      case 'all':
        return true;
      case 'with-due-date':
        return !!due;
      case 'due-today':
        return !!due && dueState(due) === 'today';
      case 'overdue':
        return !!due && dueState(due) === 'overdue';
      default:
        return false;
    }
  };
}

function itemLine(entry: MyBoardItem, withBoard: boolean): string {
  const parts = [entry.item.title];
  if (withBoard) {
    parts.push(`on ${entry.boardName}`);
  }
  if (entry.item.dueDate) {
    const state = dueState(entry.item.dueDate);
    parts.push(
      state === 'overdue'
        ? `(overdue since ${entry.item.dueDate})`
        : `(due ${entry.item.dueDate})`,
    );
  }
  return `- ${parts.join(' ')}`;
}

const MAX_LINES = 10;

function describe(entries: MyBoardItem[], withBoard: boolean): string {
  const lines = entries
    .slice(0, MAX_LINES)
    .map(entry => itemLine(entry, withBoard));
  if (entries.length > MAX_LINES) {
    lines.push(`… and ${entries.length - MAX_LINES} more`);
  }
  return lines.join('\n');
}

export interface ReminderRunOptions {
  reminder: ReminderConfig;
  service: BoardsService;
  /** Only the entity lookup is used; naming it keeps stubs honest. */
  catalog: Pick<CatalogService, 'getEntities'>;
  auth: Pick<AuthService, 'getOwnServiceCredentials'>;
  notifications: NotificationService;
  logger: LoggerService;
  /** Base path for links in notifications; defaults to `/boards`. */
  appLinkBase?: string;
}

/** One reminder run: resolve users, collect items, send notifications. */
export async function runReminder(options: ReminderRunOptions): Promise<void> {
  const { reminder, service, catalog, auth, notifications, logger } = options;
  const linkBase = options.appLinkBase ?? '/boards';
  const credentials = await auth.getOwnServiceCredentials();
  const { items: users } = await catalog.getEntities(
    {
      filter: { kind: 'User', ...reminder.userFilter },
      fields: ['kind', 'metadata', 'relations'],
    },
    { credentials },
  );

  const matches = scopeFilter(reminder.scope);
  let notified = 0;
  let messages = 0;
  for (const user of users) {
    if (matchesExclude(user, reminder.excludeUsers)) {
      continue;
    }
    const userRef = stringifyEntityRef(user);
    try {
      const groups = (user.relations ?? [])
        .filter(relation => relation.type === RELATION_MEMBER_OF)
        .map(relation => relation.targetRef);
      const entries = (
        await service.listMyItems({
          type: 'user',
          userRef,
          ownershipRefs: [userRef, ...groups],
        })
      ).filter(matches);
      if (entries.length === 0) {
        continue;
      }
      const suffix =
        reminder.scope === 'overdue'
          ? 'overdue board item(s)'
          : 'board item(s) needing attention';
      if (reminder.grouping === 'per-board') {
        const byBoard = new Map<string, MyBoardItem[]>();
        for (const entry of entries) {
          byBoard.set(entry.boardId, [
            ...(byBoard.get(entry.boardId) ?? []),
            entry,
          ]);
        }
        for (const [boardId, boardEntries] of byBoard) {
          await notifications.send({
            recipients: { type: 'entity', entityRef: [userRef] },
            payload: {
              title: `${boardEntries.length} ${suffix} on ${boardEntries[0].boardName}`,
              description: describe(boardEntries, false),
              link: `${linkBase}/${boardId}`,
              topic: `boards:reminder:${reminder.id}`,
            },
          });
          messages += 1;
        }
      } else {
        await notifications.send({
          recipients: { type: 'entity', entityRef: [userRef] },
          payload: {
            title: `You have ${entries.length} ${suffix}`,
            description: describe(entries, true),
            link: `${linkBase}/my-items`,
            topic: `boards:reminder:${reminder.id}`,
          },
        });
        messages += 1;
      }
      notified += 1;
    } catch (error) {
      logger.error(
        `Boards reminder '${reminder.id}' failed for ${userRef}: ${error}`,
      );
    }
  }
  logger.info(
    `Boards reminder '${reminder.id}' notified ${notified} user(s) with ${messages} message(s)`,
  );
}

export interface ScheduleRemindersOptions {
  config: RootConfigService;
  scheduler: SchedulerService;
  service: BoardsService;
  catalog: CatalogService;
  auth: AuthService;
  notifications: NotificationService;
  logger: LoggerService;
}

/** Registers one scheduled task per configured reminder. */
export async function scheduleReminders(
  options: ScheduleRemindersOptions,
): Promise<void> {
  const reminders = readRemindersConfig(options.config);
  for (const reminder of reminders) {
    await options.scheduler.scheduleTask({
      ...reminder.schedule,
      id: `boards-reminder-${reminder.id}`,
      fn: () => runReminder({ ...options, reminder }),
    });
  }
  if (reminders.length > 0) {
    options.logger.info(
      `Scheduled ${reminders.length} boards reminder(s): ${reminders
        .map(reminder => reminder.id)
        .join(', ')}`,
    );
  }
}
