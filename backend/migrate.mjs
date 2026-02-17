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

    // Seed: ensure system user and main branch exist (required for publishing)
    await ensureMainBranch(sql);
  } finally {
    await sql.end();
  }
}

/**
 * Ensure the system user and main branch exist.
 * These are required for the publish/convergence flow to work.
 */
async function ensureMainBranch(sql) {
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
  const MAIN_BRANCH_ID = '00000000-0000-0000-0000-000000000100';

  // Create system user if missing
  const [existingUser] = await sql`SELECT id FROM users WHERE id = ${SYSTEM_USER_ID}`;
  if (!existingUser) {
    await sql`
      INSERT INTO users (id, external_id, provider, email, display_name, roles, is_active)
      VALUES (
        ${SYSTEM_USER_ID},
        'system',
        'github',
        'system@echo-portal.internal',
        'System',
        ARRAY['administrator']::role[],
        true
      )
    `;
    console.log('[seed] System user created');
  }

  // Create main branch if missing
  const [existingBranch] = await sql`SELECT id FROM branches WHERE slug = 'main'`;
  if (!existingBranch) {
    await sql`
      INSERT INTO branches (id, name, slug, git_ref, base_ref, base_commit, head_commit, state, visibility, owner_id, reviewers, collaborators, assigned_reviewers, required_approvals, description, labels)
      VALUES (
        ${MAIN_BRANCH_ID},
        'Main',
        'main',
        'refs/heads/main',
        'main',
        'initial',
        'initial',
        'published',
        'public',
        ${SYSTEM_USER_ID},
        '{}',
        '{}',
        '{}',
        1,
        'Canonical published content',
        ARRAY['system']
      )
    `;
    console.log('[seed] Main branch created');
  }

  // Always run orphaned content migration (idempotent — skips existing slugs)
  const mainBranchId = existingBranch?.id || MAIN_BRANCH_ID;
  await migrateOrphanedContent(sql, mainBranchId);
}

/**
 * One-time fix: Copy published content from user branches to main.
 * This handles content that was published before the main branch existed.
 */
async function migrateOrphanedContent(sql, mainBranchId) {
  // Find published content not on the main branch
  const orphaned = await sql`
    SELECT c.*, cv.body, cv.body_format, cv.byte_size, cv.checksum, cv.change_description
    FROM contents c
    LEFT JOIN content_versions cv ON cv.id = c.current_version_id
    WHERE c.is_published = true
      AND c.branch_id != ${mainBranchId}
      AND c.archived_at IS NULL
  `;

  if (orphaned.length === 0) return;

  console.log(`[seed] Migrating ${orphaned.length} orphaned published content to main branch...`);

  for (const content of orphaned) {
    // Check if already exists in main by slug
    const [existing] = await sql`
      SELECT id, current_version_id FROM contents WHERE branch_id = ${mainBranchId} AND slug = ${content.slug}
    `;
    if (existing && existing.current_version_id) continue;

    // If it exists but has no version (partial from failed migration), fix it
    if (existing && !existing.current_version_id && content.body) {
      const metadataSnapshot = JSON.stringify({
        title: content.title || '',
        ...(content.category ? { category: content.category } : {}),
        tags: content.tags || [],
      });
      const [newVersion] = await sql`
        INSERT INTO content_versions (content_id, body, body_format, metadata_snapshot, change_description, author_id, author_type, byte_size, checksum)
        VALUES (
          ${existing.id},
          ${content.body},
          ${content.body_format || 'markdown'},
          ${metadataSnapshot}::jsonb,
          'Migrated from published branch',
          ${content.created_by},
          'user',
          ${content.byte_size || 0},
          ${content.checksum || ''}
        )
        RETURNING id
      `;
      await sql`
        UPDATE contents
        SET current_version_id = ${newVersion.id}, published_version_id = ${newVersion.id}
        WHERE id = ${existing.id}
      `;
      console.log(`[seed]   Fixed partial: ${content.slug} (${content.title})`);
      continue;
    }

    // Create content in main branch
    const [newContent] = await sql`
      INSERT INTO contents (branch_id, slug, title, content_type, section, category, tags, description, visibility, is_published, published_at, published_by, created_by)
      VALUES (
        ${mainBranchId},
        ${content.slug},
        ${content.title},
        ${content.content_type},
        ${content.section},
        ${content.category},
        ${content.tags},
        ${content.description},
        'public',
        true,
        ${content.published_at || new Date()},
        ${content.published_by || content.created_by},
        ${content.created_by}
      )
      RETURNING id
    `;

    // Copy the version if available
    if (content.body) {
      const metadataSnapshot = JSON.stringify({
        title: content.title || '',
        ...(content.category ? { category: content.category } : {}),
        tags: content.tags || [],
      });

      const [newVersion] = await sql`
        INSERT INTO content_versions (content_id, body, body_format, metadata_snapshot, change_description, author_id, author_type, byte_size, checksum)
        VALUES (
          ${newContent.id},
          ${content.body},
          ${content.body_format || 'markdown'},
          ${metadataSnapshot}::jsonb,
          'Migrated from published branch',
          ${content.created_by},
          'user',
          ${content.byte_size || 0},
          ${content.checksum || ''}
        )
        RETURNING id
      `;

      await sql`
        UPDATE contents
        SET current_version_id = ${newVersion.id}, published_version_id = ${newVersion.id}
        WHERE id = ${newContent.id}
      `;
    }

    console.log(`[seed]   Migrated: ${content.slug} (${content.title})`);
  }
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
