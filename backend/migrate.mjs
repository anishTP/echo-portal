/**
 * Lightweight migration runner — reads the Drizzle journal and executes
 * SQL migration files that haven't been applied yet. No drizzle-kit needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(import.meta.dirname, 'drizzle');
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, 'meta', '_journal.json');

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        tag TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Read journal
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf-8'));

    // Get already-applied migrations
    const { rows: applied } = await client.query('SELECT tag FROM __drizzle_migrations');
    const appliedTags = new Set(applied.map((r) => r.tag));

    // Apply pending migrations in order
    let count = 0;
    for (const entry of journal.entries) {
      if (appliedTags.has(entry.tag)) continue;

      const sqlFile = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
      const sql = fs.readFileSync(sqlFile, 'utf-8');

      console.log(`[migrate] Applying ${entry.tag}...`);
      await client.query(sql);
      await client.query('INSERT INTO __drizzle_migrations (tag) VALUES ($1)', [entry.tag]);
      count++;
    }

    if (count === 0) {
      console.log('[migrate] Database is up to date');
    } else {
      console.log(`[migrate] Applied ${count} migration(s)`);
    }
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
