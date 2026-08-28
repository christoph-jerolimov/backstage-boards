import { LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CatalogProcessorCache } from '@backstage/plugin-catalog-node';
import { JsonValue } from '@backstage/types';
import {
  BoardsCatalogProcessor,
  BoardsCatalogProcessorOptions,
} from './BoardsCatalogProcessor';

const warn = jest.fn();

const logger: LoggerService = {
  info: () => {},
  warn,
  error: () => {},
  debug: () => {},
  child: () => logger,
};

const discovery: BoardsCatalogProcessorOptions['discovery'] = {
  getBaseUrl: async () => 'http://localhost:7007/api/boards',
};

const auth: BoardsCatalogProcessorOptions['auth'] = {
  getOwnServiceCredentials: async () => ({
    $$type: '@backstage/BackstageCredentials',
    principal: { type: 'service', subject: 'plugin:catalog' },
  }),
  getPluginRequestToken: async () => ({ token: 'token' }),
};

/** In-memory stand-in for the per-entity, per-processor cache. */
function createCache(
  initial?: Record<string, JsonValue>,
): CatalogProcessorCache {
  const store = new Map<string, JsonValue>(Object.entries(initial ?? {}));
  return {
    // the cache is keyed by string and holds any JSON, so reading an entry
    // back as the type the caller asked for is what the interface promises
    get: async <ItemType extends JsonValue>(key: string) =>
      store.get(key) as ItemType | undefined,
    set: async (key, value) => {
      store.set(key, value);
    },
  };
}

function entityWithLabels(labels?: Record<string, string>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'payments',
      namespace: 'default',
      ...(labels && { labels }),
    },
    spec: { type: 'service' },
  };
}

/** A real response, so the processor parses it the way it would in production. */
function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('BoardsCatalogProcessor', () => {
  let processor: BoardsCatalogProcessor;
  let fetchMock: jest.SpyInstance<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >;

  const location = { type: 'url', target: 'https://example.com/x.yaml' };

  const process = (entity: Entity, cache = createCache()) =>
    processor.postProcessEntity(entity, location, () => {}, cache);

  beforeEach(() => {
    processor = new BoardsCatalogProcessor({ discovery, auth, logger });
    fetchMock = jest.spyOn(global, 'fetch');
    warn.mockClear();
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('has a stable processor name', () => {
    expect(processor.getProcessorName()).toBe('BoardsCatalogProcessor');
  });

  it('labels an entity a board references', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ referenced: true }));
    const result = await process(entityWithLabels());
    expect(result.metadata.labels).toEqual({
      'boards/is-referenced': 'auto-detected',
    });
  });

  it('asks the boards backend for this entity, as a service', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ referenced: true }));
    await process(entityWithLabels());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://localhost:7007/api/boards/service/entity-references?entityRef=component%3Adefault%2Fpayments',
    );
    expect(init?.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('leaves an unreferenced entity unlabelled and keeps other labels', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ referenced: false }));
    const result = await process(entityWithLabels({ tier: 'one' }));
    expect(result.metadata.labels).toEqual({ tier: 'one' });
  });

  it('strips a label the entity declared itself', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ referenced: false }));
    const result = await process(
      entityWithLabels({ 'boards/is-referenced': 'auto-detected' }),
    );
    expect(result.metadata.labels).toEqual({});
  });

  it('reuses the cached answer when the backend cannot be reached', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ referenced: true }));
    const cache = createCache();
    await process(entityWithLabels(), cache);

    fetchMock.mockRejectedValue(new Error('connection refused'));
    const result = await process(entityWithLabels(), cache);
    expect(result.metadata.labels).toEqual({
      'boards/is-referenced': 'auto-detected',
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('keeping the last known state'),
    );
  });

  it('does not throw, and leaves the entity unlabelled, without a cached answer', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
    const result = await process(entityWithLabels());
    expect(result.metadata.labels).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('leaving the entity unlabelled'),
    );
  });

  it('treats a non-ok response as a failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({}, { status: 403, statusText: 'Forbidden' }),
    );
    const result = await process(
      entityWithLabels({ 'boards/is-referenced': 'auto-detected' }),
    );
    expect(result.metadata.labels).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('403'));
  });
});
