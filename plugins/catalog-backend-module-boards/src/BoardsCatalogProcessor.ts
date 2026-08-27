import {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorCache,
} from '@backstage/plugin-catalog-node';
import {
  BOARDS_ENTITY_IS_REFERENCED_LABEL,
  BOARDS_ENTITY_IS_REFERENCED_LABEL_VALUE,
} from '@internal/plugin-boards-common';

/** Cache key holding the last successfully resolved answer for an entity. */
const CACHE_KEY = 'referenced';

/**
 * Returns the entity with the `boards` label set or removed, or the entity
 * itself when it already says the right thing.
 */
function withBoardsLabel(entity: Entity, referenced: boolean): Entity {
  const current = entity.metadata.labels?.[BOARDS_ENTITY_IS_REFERENCED_LABEL];
  if (referenced && current === BOARDS_ENTITY_IS_REFERENCED_LABEL_VALUE) {
    return entity;
  }
  if (!referenced && current === undefined) {
    return entity;
  }
  const labels = { ...entity.metadata.labels };
  if (referenced) {
    labels[BOARDS_ENTITY_IS_REFERENCED_LABEL] =
      BOARDS_ENTITY_IS_REFERENCED_LABEL_VALUE;
  } else {
    delete labels[BOARDS_ENTITY_IS_REFERENCED_LABEL];
  }
  return { ...entity, metadata: { ...entity.metadata, labels } };
}

/**
 * Labels every entity that at least one non-archived board references with
 * `boards/is-referenced: "auto-detected"`, and removes that label from every
 * other entity.
 *
 * The label is always derived from the boards backend, never taken from the
 * entity's own description, so a `catalog-info.yaml` cannot claim it. The
 * entity "Boards" tab is shown exactly where the label is.
 *
 * @public
 */
export class BoardsCatalogProcessor implements CatalogProcessor {
  private readonly discovery: DiscoveryService;
  private readonly auth: AuthService;
  private readonly logger: LoggerService;

  constructor(options: {
    discovery: DiscoveryService;
    auth: AuthService;
    logger: LoggerService;
  }) {
    this.discovery = options.discovery;
    this.auth = options.auth;
    this.logger = options.logger;
  }

  getProcessorName(): string {
    return 'BoardsCatalogProcessor';
  }

  async postProcessEntity(
    entity: Entity,
    _location: unknown,
    _emit: unknown,
    cache: CatalogProcessorCache,
  ): Promise<Entity> {
    const entityRef = stringifyEntityRef(entity);
    return withBoardsLabel(
      entity,
      await this.resolveReferenced(entityRef, cache),
    );
  }

  /**
   * Asks the boards backend, remembering the answer per entity. A backend
   * that cannot be reached must not fail the entity's processing — that would
   * mark the whole catalog as errored during a boards outage — so the last
   * known answer is reused and the label freezes instead of flapping.
   */
  private async resolveReferenced(
    entityRef: string,
    cache: CatalogProcessorCache,
  ): Promise<boolean> {
    try {
      const referenced = await this.requestReferenced(entityRef);
      await cache.set(CACHE_KEY, referenced);
      return referenced;
    } catch (error) {
      const cached = await cache.get<boolean>(CACHE_KEY);
      this.logger.warn(
        `Could not determine board references for ${entityRef}, ${
          cached === undefined
            ? 'leaving the entity unlabelled'
            : `keeping the last known state (referenced=${cached})`
        }: ${error}`,
      );
      return cached ?? false;
    }
  }

  private async requestReferenced(entityRef: string): Promise<boolean> {
    const baseUrl = await this.discovery.getBaseUrl('boards');
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: 'boards',
    });
    const response = await fetch(
      `${baseUrl}/service/entity-references?entityRef=${encodeURIComponent(
        entityRef,
      )}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new Error(
        `Boards backend responded ${response.status} ${response.statusText}`,
      );
    }
    const body = (await response.json()) as { referenced?: boolean };
    return !!body.referenced;
  }
}
