/**
 * Fix script to remove duplicate content in main branch.
 *
 * Run with: npx tsx src/db/fix-duplicate-content.ts
 *
 * When the same content slug exists multiple times in main branch,
 * this keeps the most recent one (by publishedAt) and archives the rest.
 */

import { eq, desc, isNull } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';

async function fixDuplicateContent() {
  console.log('Fixing duplicate content in main branch...\n');

  // Get the main branch
  const mainBranch = await db.query.branches.findFirst({
    where: eq(schema.branches.slug, 'main'),
  });

  if (!mainBranch) {
    console.error('Main branch not found! Run seed first.');
    process.exit(1);
  }

  console.log(`Main branch ID: ${mainBranch.id}\n`);

  // Get all non-archived content in main branch
  const mainContent = await db.query.contents.findMany({
    where: eq(schema.contents.branchId, mainBranch.id),
    orderBy: [desc(schema.contents.publishedAt)],
  });

  // Group by slug
  const slugGroups = new Map<string, typeof mainContent>();
  for (const content of mainContent) {
    if (content.archivedAt) continue; // Skip already archived

    const group = slugGroups.get(content.slug) || [];
    group.push(content);
    slugGroups.set(content.slug, group);
  }

  // Find duplicates
  let duplicatesFound = 0;
  let duplicatesArchived = 0;

  for (const [slug, contents] of slugGroups.entries()) {
    if (contents.length <= 1) continue;

    duplicatesFound += contents.length - 1;
    console.log(`Found ${contents.length} items with slug "${slug}"`);

    // Keep the first one (most recent by publishedAt due to ordering)
    const [keep, ...toArchive] = contents;
    console.log(`  Keeping: ${keep.id} (published: ${keep.publishedAt?.toISOString()})`);

    for (const content of toArchive) {
      await db
        .update(schema.contents)
        .set({ archivedAt: new Date() })
        .where(eq(schema.contents.id, content.id));

      console.log(`  Archived: ${content.id} (published: ${content.publishedAt?.toISOString()})`);
      duplicatesArchived++;
    }
  }

  console.log(`\nDuplicates found: ${duplicatesFound}`);
  console.log(`Duplicates archived: ${duplicatesArchived}`);
}

fixDuplicateContent()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
  });
