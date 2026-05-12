import type { Knex } from 'knex';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.development') });
config({ path: resolve(process.cwd(), '.env'), override: false });

const DATABASE_URL = process.env.DATABASE_URL || '';

const isPostgres = DATABASE_URL.startsWith('postgres');

const knexConfig: Knex.Config = isPostgres
  ? {
      client: 'pg',
      connection: DATABASE_URL,
      pool: { min: 2, max: 10 },
      migrations: { directory: './src/database/migrations', extension: 'ts' },
      seeds: { directory: './src/database/seeds', extension: 'ts' }
    }
  : {
      client: 'better-sqlite3',
      connection: { filename: resolve(process.cwd(), '../../data/payment.db') },
      useNullAsDefault: true,
      pool: { afterCreate: (conn: any, cb: any) => { conn.exec('PRAGMA journal_mode=WAL;'); cb(null, conn); } },
      migrations: { directory: './src/database/migrations', extension: 'ts' },
      seeds: { directory: './src/database/seeds', extension: 'ts' }
    };

export default knexConfig;
