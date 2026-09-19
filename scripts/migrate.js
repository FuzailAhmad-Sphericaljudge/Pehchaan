import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured before running migrations.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const files = (await fs.readdir(path.resolve(process.cwd(), 'migrations')))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    if (existing.rowCount) continue;
    const sql = await fs.readFile(path.resolve(process.cwd(), 'migrations', file), 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
    console.log(`Applied ${file}`);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
