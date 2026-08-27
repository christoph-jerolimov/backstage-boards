import {
  BOARDS_ENTITY_LABEL,
  BOARDS_ENTITY_LABEL_PATH,
  BOARDS_ENTITY_LABEL_VALUE,
} from './index';

describe('boards entity label', () => {
  it('is exported from the package index', () => {
    expect(BOARDS_ENTITY_LABEL).toBe('boards');
    expect(BOARDS_ENTITY_LABEL_VALUE).toBe('true');
  });

  it('exposes the label as an entity path for filter predicates', () => {
    expect(BOARDS_ENTITY_LABEL_PATH).toBe(
      `metadata.labels.${BOARDS_ENTITY_LABEL}`,
    );
  });
});
