import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Knex } from 'knex';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { notificationService } from '@backstage/plugin-notifications-node';
import { signalsServiceRef } from '@backstage/plugin-signals-node';
import { applyDatabaseMigrations } from './database/migrations';
import { BoardsService } from './service/BoardsService';
import { createRouter } from './router';
import { registerActions } from './actions';

/**
 * The boards backend plugin: shareable kanban boards with items, comments,
 * change history, watching, and actions-registry actions.
 *
 * @public
 */
export const boardsPlugin = createBackendPlugin({
  pluginId: 'boards',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        database: coreServices.database,
        scheduler: coreServices.scheduler,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        userInfo: coreServices.userInfo,
        notifications: notificationService,
        signals: signalsServiceRef,
        actionsRegistry: actionsRegistryServiceRef,
      },
      async init({
        logger,
        database,
        scheduler,
        httpRouter,
        httpAuth,
        auth,
        userInfo,
        notifications,
        signals,
        actionsRegistry,
      }) {
        // the framework bundles its own copy of the knex types
        const knex = (await database.getClient()) as unknown as Knex;
        await applyDatabaseMigrations(knex);

        const service = new BoardsService({
          knex,
          logger,
          notifications,
          signals,
        });

        httpRouter.use(
          await createRouter({ service, httpAuth, auth, userInfo, logger }),
        );
        // Unauthenticated requests must reach the router so that boards with
        // `public-read`/`public-write` visibility work without a login; the
        // access resolver enforces visibility on every request.
        httpRouter.addAuthPolicy({ path: '/', allow: 'unauthenticated' });

        registerActions({ actionsRegistry, service, auth, userInfo });

        const RETENTION_DAYS = 30;
        await scheduler.scheduleTask({
          id: 'boards-purge-archived-items',
          frequency: { hours: 6 },
          timeout: { minutes: 5 },
          initialDelay: { minutes: 1 },
          fn: async () => {
            await service.purgeArchivedItems(
              new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000),
            );
          },
        });
      },
    });
  },
});
