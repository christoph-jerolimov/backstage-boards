import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { notificationService } from '@backstage/plugin-notifications-node';
import { signalsServiceRef } from '@backstage/plugin-signals-node';
import { applyDatabaseMigrations } from './database/migrations';
import { BoardsService } from './service/BoardsService';
import { createRouter } from './router';
import { registerActions } from './actions';
import { scheduleReminders } from './reminders';

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
        config: coreServices.rootConfig,
        database: coreServices.database,
        scheduler: coreServices.scheduler,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        userInfo: coreServices.userInfo,
        catalog: catalogServiceRef,
        notifications: notificationService,
        signals: signalsServiceRef,
        actionsRegistry: actionsRegistryServiceRef,
      },
      async init({
        logger,
        config,
        database,
        scheduler,
        httpRouter,
        httpAuth,
        auth,
        userInfo,
        catalog,
        notifications,
        signals,
        actionsRegistry,
      }) {
        const knex = await database.getClient();
        await applyDatabaseMigrations(knex);

        const refreshEntities = async (entityRefs: string[]) => {
          const credentials = await auth.getOwnServiceCredentials();
          for (const entityRef of entityRefs) {
            try {
              await catalog.refreshEntity(entityRef, { credentials });
            } catch (error) {
              logger.warn(
                `Failed to refresh catalog entity ${entityRef}: ${error}`,
              );
            }
          }
        };

        const service = new BoardsService({
          knex,
          logger,
          notifications,
          signals,
          // Board assignments decide the `boards` label the catalog processor
          // derives, so a refresh makes the catalog re-derive it right away
          // instead of at the next processing sweep. Best effort: refs the
          // catalog does not know are normal and must not fail a board write.
          onEntityRefsChanged: entityRefs => {
            refreshEntities(entityRefs).catch(error => {
              logger.warn(`Failed to refresh catalog entities: ${error}`);
            });
          },
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
          id: 'boards-purge-archived',
          frequency: { hours: 6 },
          timeout: { minutes: 5 },
          initialDelay: { minutes: 1 },
          fn: async () => {
            const cutoff = new Date(
              Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
            );
            await service.purgeArchivedItems(cutoff);
            await service.purgeArchivedBoards(cutoff);
          },
        });

        await scheduleReminders({
          config,
          scheduler,
          service,
          catalog,
          auth,
          notifications,
          logger,
        });
      },
    });
  },
});
