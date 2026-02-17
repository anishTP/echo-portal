/**
 * Lightweight migration runner — reads the Drizzle journal and executes
 * SQL migration files that haven't been applied yet.
 * Uses postgres.js (the same driver as the backend).
 * Splits on --> statement-breakpoint and tolerates "already exists" errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR = path.join(import.meta.dirname, 'drizzle');
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, 'meta', '_journal.json');

// Postgres error codes that are safe to ignore (object already exists)
const IGNORABLE_CODES = new Set([
  '42P07', // relation already exists
  '42P06', // schema already exists
  '42710', // type/constraint already exists
  '42701', // column already exists
]);

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // Create migrations tracking table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        tag TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Read journal
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf-8'));

    // Get already-applied migrations
    const applied = await sql`SELECT tag FROM __drizzle_migrations`;
    const appliedTags = new Set(applied.map((r) => r.tag));

    // Apply pending migrations in order
    let count = 0;
    for (const entry of journal.entries) {
      if (appliedTags.has(entry.tag)) continue;

      const sqlFile = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
      const migration = fs.readFileSync(sqlFile, 'utf-8');

      console.log(`[migrate] Applying ${entry.tag}...`);

      // Split on Drizzle's statement breakpoint marker
      const statements = migration
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt);
        } catch (err) {
          if (IGNORABLE_CODES.has(err.code)) {
            console.log(`[migrate]   Skipped (already exists): ${stmt.slice(0, 80)}...`);
          } else {
            throw err;
          }
        }
      }

      await sql`INSERT INTO __drizzle_migrations (tag) VALUES (${entry.tag})`;
      count++;
    }

    if (count === 0) {
      console.log('[migrate] Database is up to date');
    } else {
      console.log(`[migrate] Applied ${count} migration(s)`);
    }
  } finally {
    await sql.end();
  }
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
