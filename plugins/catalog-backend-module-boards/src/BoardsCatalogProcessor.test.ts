import { Entity } from '@backstage/catalog-model';
import { CatalogProcessorCache } from '@backstage/plugin-catalog-node';
import { BoardsCatalogProcessor } from './BoardsCatalogProcessor';

const logger = {
  info: () => {},
  warn: jest.fn(),
  error: () => {},
  debug: () => {},
  child: function child() {
    return this;
  },
} as any;

const discovery = {
  getBaseUrl: async () => 'http://localhost:7007/api/boards',
  getExternalBaseUrl: async () => 'http://localhost:7007/api/boards',
};

const auth = {
  getOwnServiceCredentials: async () => ({ principal: 'plugin:catalog' }),
  getPluginRequestToken: async () => ({ token: 'token' }),
} as any;

/** In-memory stand-in for the per-entity, per-processor cache. */
function createCache(initial?: Record<string, unknown>): CatalogProcessorCache {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}));
  return {
    get: async (key: string) => store.get(key) as any,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  } as CatalogProcessorCache;
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

function mockResponse(referenced: boolean) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ referenced }),
  } as Response;
}

describe('BoardsCatalogProcessor', () => {
  let processor: BoardsCatalogProcessor;
  let fetchMock: jest.SpyInstance;

  const process = (entity: Entity, cache = createCache()) =>
    processor.postProcessEntity(entity, {} as any, () => {}, cache);

  beforeEach(() => {
    processor = new BoardsCatalogProcessor({
      discovery: discovery as any,
      auth,
      logger,
    });
    fetchMock = jest.spyOn(global, 'fetch' as any);
    logger.warn.mockClear();
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('has a stable processor name', () => {
    expect(processor.getProcessorName()).toBe('BoardsCatalogProcessor');
  });

  it('labels an entity a board references', async () => {
    fetchMock.mockResolvedValue(mockResponse(true));
    const result = await process(entityWithLabels());
    expect(result.metadata.labels).toEqual({
      'boards/is-referenced': 'auto-detected',
    });
  });

  it('asks the boards backend for this entity, as a service', async () => {
    fetchMock.mockResolvedValue(mockResponse(true));
    await process(entityWithLabels());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://localhost:7007/api/boards/service/entity-references?entityRef=component%3Adefault%2Fpayments',
    );
    expect(init.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('leaves an unreferenced entity unlabelled and keeps other labels', async () => {
    fetchMock.mockResolvedValue(mockResponse(false));
    const result = await process(entityWithLabels({ tier: 'one' }));
    expect(result.metadata.labels).toEqual({ tier: 'one' });
  });

  it('strips a label the entity declared itself', async () => {
    fetchMock.mockResolvedValue(mockResponse(false));
    const result = await process(
      entityWithLabels({ 'boards/is-referenced': 'auto-detected' }),
    );
    expect(result.metadata.labels).toEqual({});
  });

  it('reuses the cached answer when the backend cannot be reached', async () => {
    fetchMock.mockResolvedValue(mockResponse(true));
    const cache = createCache();
    await process(entityWithLabels(), cache);

    fetchMock.mockRejectedValue(new Error('connection refused'));
    const result = await process(entityWithLabels(), cache);
    expect(result.metadata.labels).toEqual({
      'boards/is-referenced': 'auto-detected',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('keeping the last known state'),
    );
  });

  it('does not throw, and leaves the entity unlabelled, without a cached answer', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
    const result = await process(entityWithLabels());
    expect(result.metadata.labels).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('leaving the entity unlabelled'),
    );
  });

  it('treats a non-ok response as a failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({}),
    } as Response);
    const result = await process(
      entityWithLabels({ 'boards/is-referenced': 'auto-detected' }),
    );
    expect(result.metadata.labels).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('403'));
  });
});
