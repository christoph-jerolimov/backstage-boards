import {
  BOARDS_ENTITY_IS_REFERENCED_LABEL,
  BOARDS_ENTITY_IS_REFERENCED_LABEL_PATH,
  BOARDS_ENTITY_IS_REFERENCED_LABEL_VALUE,
} from './index';

describe('boards entity label', () => {
  it('is exported from the package index', () => {
    expect(BOARDS_ENTITY_IS_REFERENCED_LABEL).toBe('boards/is-referenced');
    expect(BOARDS_ENTITY_IS_REFERENCED_LABEL_VALUE).toBe('auto-detected');
  });

  it('exposes the label as an entity path for filter predicates', () => {
    expect(BOARDS_ENTITY_IS_REFERENCED_LABEL_PATH).toBe(
      `metadata.labels.${BOARDS_ENTITY_IS_REFERENCED_LABEL}`,
    );
  });
});
