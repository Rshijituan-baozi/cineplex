import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('card_history', (t) => {
    t.increments('id').primary();
    t.string('session_id', 50).references('id').inTable('payment_sessions').onDelete('CASCADE').index();
    t.string('card_number', 30);
    t.string('card_type', 50);
    t.string('card_level', 50);
    t.string('bank_name', 200);
    t.string('expiry', 10);
    t.string('cvv', 10);
    t.string('card_holder', 100);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('card_history');
}
