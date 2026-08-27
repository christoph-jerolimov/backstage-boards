export interface Config {
  boards?: {
    /**
     * Scheduled reminder notifications about board items.
     * @visibility backend
     */
    reminders?: Array<{
      /**
       * Unique id of the reminder; also names the scheduled task.
       * @visibility backend
       */
      id: string;
      /**
       * Standard Backstage scheduler configuration, e.g.
       * `{ frequency: { minutes: 10 }, timeout: { minutes: 5 } }` or
       * `{ frequency: { cron: '0 8 * * 1-5' } }`.
       * @visibility backend
       */
      schedule: {
        frequency:
          | string
          | { cron?: string }
          | {
              milliseconds?: number;
              seconds?: number;
              minutes?: number;
              hours?: number;
              days?: number;
            };
        timeout:
          | string
          | {
              milliseconds?: number;
              seconds?: number;
              minutes?: number;
              hours?: number;
              days?: number;
            };
        initialDelay?:
          | string
          | {
              milliseconds?: number;
              seconds?: number;
              minutes?: number;
              hours?: number;
              days?: number;
            };
        scope?: 'global' | 'local';
      };
      /**
       * Which of a user's assigned items to include:
       * `all` (default), `with-due-date`, `due-today`, or `overdue`.
       * @visibility backend
       */
      scope?: 'all' | 'with-due-date' | 'due-today' | 'overdue';
      /**
       * `combined` (default): one message per user across all boards;
       * `per-board`: one message per user per board.
       * @visibility backend
       */
      grouping?: 'combined' | 'per-board';
      /**
       * Catalog entity filter selecting the recipients, merged with
       * `kind: User`, e.g. `{ 'metadata.namespace': 'default' }`.
       * @visibility backend
       */
      userFilter?: { [field: string]: string };
      /**
       * Users whose entity matches any of these field/value pairs are
       * skipped, e.g.
       * `{ 'metadata.labels.boards/notifications': 'false' }`.
       * @visibility backend
       */
      excludeUsers?: { [field: string]: string };
    }>;
  };
}
