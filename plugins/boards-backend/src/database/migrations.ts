import { Knex } from 'knex';

type Migration = {
  name: string;
  up: (knex: Knex) => Promise<void>;
  down: (knex: Knex) => Promise<void>;
};

const initial: Migration = {
  name: '20260827_initial',
  async up(knex) {
    await knex.schema.createTable('boards', table => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('entity_ref').nullable();
      table.string('visibility').notNullable().defaultTo('private');
      table.string('created_by').notNullable();
      table.string('created_at').notNullable();
      table.string('updated_at').notNullable();
    });

    await knex.schema.createTable('board_columns', table => {
      table.string('id').primary();
      table
        .string('board_id')
        .notNullable()
        .references('id')
        .inTable('boards')
        .onDelete('CASCADE');
      table.string('title').notNullable();
      table.double('position').notNullable();
      table.index(['board_id']);
    });

    await knex.schema.createTable('board_permissions', table => {
      table.string('id').primary();
      table
        .string('board_id')
        .notNullable()
        .references('id')
        .inTable('boards')
        .onDelete('CASCADE');
      table.string('principal_ref').notNullable();
      table.string('level').notNullable();
      table.unique(['board_id', 'principal_ref']);
    });

    await knex.schema.createTable('items', table => {
      table.string('id').primary();
      table
        .string('board_id')
        .notNullable()
        .references('id')
        .inTable('boards')
        .onDelete('CASCADE');
      table
        .string('column_id')
        .notNullable()
        .references('id')
        .inTable('board_columns')
        .onDelete('CASCADE');
      table.double('position').notNullable();
      table.string('title').notNullable();
      table.string('created_by').notNullable();
      table.string('created_at').notNullable();
      table.string('updated_by').notNullable();
      table.string('updated_at').notNullable();
      table.string('creator_ref').nullable();
      table.string('external_manager').nullable();
      table.index(['board_id']);
      table.index(['column_id']);
    });

    await knex.schema.createTable('item_assignees', table => {
      table
        .string('item_id')
        .notNullable()
        .references('id')
        .inTable('items')
        .onDelete('CASCADE');
      table.string('assignee_ref').notNullable();
      table.unique(['item_id', 'assignee_ref']);
    });

    await knex.schema.createTable('item_labels', table => {
      table
        .string('item_id')
        .notNullable()
        .references('id')
        .inTable('items')
        .onDelete('CASCADE');
      table.string('key').notNullable();
      table.string('value').notNullable();
      table.unique(['item_id', 'key']);
    });

    await knex.schema.createTable('item_tags', table => {
      table
        .string('item_id')
        .notNullable()
        .references('id')
        .inTable('items')
        .onDelete('CASCADE');
      table.string('tag').notNullable();
      table.unique(['item_id', 'tag']);
    });

    await knex.schema.createTable('comments', table => {
      table.string('id').primary();
      table
        .string('item_id')
        .notNullable()
        .references('id')
        .inTable('items')
        .onDelete('CASCADE');
      table.string('author_ref').notNullable();
      table.string('created_at').notNullable();
      table.index(['item_id']);
    });

    await knex.schema.createTable('comment_versions', table => {
      table.string('id').primary();
      table
        .string('comment_id')
        .notNullable()
        .references('id')
        .inTable('comments')
        .onDelete('CASCADE');
      table.text('text').notNullable();
      table.string('edited_by').notNullable();
      table.string('edited_at').notNullable();
      table.index(['comment_id']);
    });

    await knex.schema.createTable('changes', table => {
      table.string('id').primary();
      table
        .string('item_id')
        .notNullable()
        .references('id')
        .inTable('items')
        .onDelete('CASCADE');
      table
        .string('board_id')
        .notNullable()
        .references('id')
        .inTable('boards')
        .onDelete('CASCADE');
      table.string('actor_ref').notNullable();
      table.string('at').notNullable();
      table.string('type').notNullable();
      table.string('field').nullable();
      table.text('old_value').nullable();
      table.text('new_value').nullable();
      table.index(['item_id']);
      table.index(['board_id']);
    });

    await knex.schema.createTable('favorites', table => {
      table.string('user_ref').notNullable();
      table
        .string('board_id')
        .notNullable()
        .references('id')
        .inTable('boards')
        .onDelete('CASCADE');
      table.unique(['user_ref', 'board_id']);
    });

    await knex.schema.createTable('watches', table => {
      table.string('user_ref').notNullable();
      table.string('target_type').notNullable();
      table.string('target_id').notNullable();
      table.unique(['user_ref', 'target_type', 'target_id']);
      table.index(['target_type', 'target_id']);
    });
  },
  async down(knex) {
    for (const table of [
      'watches',
      'favorites',
      'changes',
      'comment_versions',
      'comments',
      'item_tags',
      'item_labels',
      'item_assignees',
      'items',
      'board_permissions',
      'board_columns',
      'boards',
    ]) {
      await knex.schema.dropTableIfExists(table);
    }
  },
};

const itemDescriptions: Migration = {
  name: '20260827_02_item_descriptions',
  async up(knex) {
    await knex.schema.alterTable('items', table => {
      table.text('description').nullable();
    });
    await knex.schema.createTable('item_description_versions', table => {
      table.string('id').primary();
      table
        .string('item_id')
        .notNullable()
        .references('id')
        .inTable('items')
        .onDelete('CASCADE');
      table.text('text').notNullable();
      table.string('edited_by').notNullable();
      table.string('edited_at').notNullable();
      table.index(['item_id']);
    });
  },
  async down(knex) {
    await knex.schema.dropTableIfExists('item_description_versions');
    await knex.schema.alterTable('items', table => {
      table.dropColumn('description');
    });
  },
};

const itemArchival: Migration = {
  name: '20260827_03_item_archival',
  async up(knex) {
    await knex.schema.alterTable('items', table => {
      table.string('archived_at').nullable();
      table.string('archived_by').nullable();
    });
  },
  async down(knex) {
    await knex.schema.alterTable('items', table => {
      table.dropColumn('archived_at');
      table.dropColumn('archived_by');
    });
  },
};

const columnColors: Migration = {
  name: '20260827_04_column_colors',
  async up(knex) {
    await knex.schema.alterTable('board_columns', table => {
      table.string('color').nullable();
    });
  },
  async down(knex) {
    await knex.schema.alterTable('board_columns', table => {
      table.dropColumn('color');
    });
  },
};

const migrations: Migration[] = [
  initial,
  itemDescriptions,
  itemArchival,
  columnColors,
];

class BoardsMigrationSource implements Knex.MigrationSource<Migration> {
  async getMigrations(): Promise<Migration[]> {
    return migrations;
  }
  getMigrationName(migration: Migration): string {
    return migration.name;
  }
  async getMigration(migration: Migration): Promise<Knex.Migration> {
    return migration;
  }
}

export async function applyDatabaseMigrations(knex: Knex): Promise<void> {
  await knex.migrate.latest({
    migrationSource: new BoardsMigrationSource(),
  });
}
