import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('payment_sessions', (t) => {
    t.string('id', 50).primary();
    t.string('session_id', 20).index();
    t.string('customer_id', 100).index();
    t.string('frontend_url', 500).defaultTo('');
    t.string('status', 30).defaultTo('live').index();
    t.string('current_step', 30).defaultTo('card');
    t.json('card_info');
    t.json('customer_info');
    t.json('browsing_tabs');
    t.boolean('is_online').defaultTo(true);
    t.integer('countdown_seconds').defaultTo(0);
    t.timestamp('pending_at');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_sessions');
}
