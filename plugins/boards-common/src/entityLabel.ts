/**
 * The catalog entity label that marks entities referenced by at least one
 * non-archived board.
 *
 * The label is derived by the boards catalog processor on every processing
 * run: it is set on referenced entities and removed from all others, so a
 * value declared in an entity's own description never survives.
 */
export const BOARDS_ENTITY_LABEL = 'boards';

/** The only value {@link BOARDS_ENTITY_LABEL} is ever set to. */
export const BOARDS_ENTITY_LABEL_VALUE = 'true';

/**
 * The label as a dot-separated entity path, for use in catalog filter
 * predicates such as the one deciding where the entity "Boards" tab appears.
 */
export const BOARDS_ENTITY_LABEL_PATH = `metadata.labels.${BOARDS_ENTITY_LABEL}`;
