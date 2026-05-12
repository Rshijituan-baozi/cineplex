import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('username', 50).unique().notNullable();
    t.string('password_hash', 255).notNullable();
    t.string('real_name', 100).defaultTo('');
    t.string('email', 200).defaultTo('');
    t.string('phone', 50).defaultTo('');
    t.json('roles').defaultTo('["R_USER"]');
    t.string('status', 1).defaultTo('1');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
