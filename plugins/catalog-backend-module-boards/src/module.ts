import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { BoardsCatalogProcessor } from './BoardsCatalogProcessor';

/**
 * Registers the {@link BoardsCatalogProcessor} with the catalog, so entities
 * referenced by a board carry the `boards` label the entity "Boards" tab
 * filters on.
 *
 * @public
 */
export const catalogModuleBoards = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'boards',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
        logger: coreServices.logger,
      },
      async init({ catalog, discovery, auth, logger }) {
        catalog.addProcessor(
          new BoardsCatalogProcessor({ discovery, auth, logger }),
        );
      },
    });
  },
});
