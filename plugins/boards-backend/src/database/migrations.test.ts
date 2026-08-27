import { createTestKnex } from '../service/testUtils';
import { applyDatabaseMigrations } from './migrations';

describe('migrations', () => {
  it('creates all tables on sqlite', async () => {
    const knex = await createTestKnex();
    for (const table of [
      'boards',
      'board_columns',
      'board_permissions',
      'items',
      'item_assignees',
      'item_labels',
      'item_tags',
      'comments',
      'comment_versions',
      'changes',
      'favorites',
      'watches',
    ]) {
      expect(await knex.schema.hasTable(table)).toBe(true);
    }
    await knex.destroy();
  });

  it('is idempotent', async () => {
    const knex = await createTestKnex();
    await expect(applyDatabaseMigrations(knex)).resolves.toBeUndefined();
    await knex.destroy();
  });
});
