import { createTestKnex } from '../service/testUtils';
import { applyDatabaseMigrations, BoardsMigrationSource } from './migrations';

describe('migrations', () => {
  it('creates all tables on sqlite', async () => {
    const knex = await createTestKnex();
    for (const table of [
      'boards',
      'board_columns',
      'board_priorities',
      'board_permissions',
      'items',
      'item_assignees',
      'item_tags',
      'item_checklist_entries',
      'comments',
      'comment_versions',
      'changes',
      'favorites',
      'watches',
    ]) {
      expect(await knex.schema.hasTable(table)).toBe(true);
    }
    // labels were removed
    expect(await knex.schema.hasTable('item_labels')).toBe(false);
    expect(await knex.schema.hasColumn('items', 'priority_id')).toBe(true);
    await knex.destroy();
  });

  it('is idempotent', async () => {
    const knex = await createTestKnex();
    await expect(applyDatabaseMigrations(knex)).resolves.toBeUndefined();
    await knex.destroy();
  });

  it('rolls back the checklist migration', async () => {
    const knex = await createTestKnex();
    expect(await knex.schema.hasTable('item_checklist_entries')).toBe(true);
    await knex.migrate.down({
      migrationSource: new BoardsMigrationSource(),
    });
    expect(await knex.schema.hasTable('item_checklist_entries')).toBe(false);
    await knex.migrate.latest({
      migrationSource: new BoardsMigrationSource(),
    });
    expect(await knex.schema.hasTable('item_checklist_entries')).toBe(true);
    await knex.destroy();
  });
});
