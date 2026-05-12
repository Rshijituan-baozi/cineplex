import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bin_cache', (t) => {
    t.string('bin', 10).primary();
    t.string('brand', 50);
    t.string('type', 50);
    t.string('issuer', 200);
    t.string('country', 5);
    t.timestamp('cached_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bin_cache');
}
