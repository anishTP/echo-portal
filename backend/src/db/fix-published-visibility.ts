/**
 * Fix script to correct visibility for published content.
 *
 * Run with: npx tsx src/db/fix-published-visibility.ts
 *
 * This fixes two issues:
 * 1. Content on main branch that is published but has visibility='private' → set to 'public'
 * 2. Content on user branches that incorrectly has visibility='public' → set to 'private'
 *
 * Only main branch content should have visibility='public'.
 */

import { eq, and, ne } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';

async function fixPublishedVisibility() {
  console.log('Fixing visibility for published content...\n');

  // Get the main branch
  const mainBranch = await db.query.branches.findFirst({
    where: eq(schema.branches.slug, 'main'),
  });

  if (!mainBranch) {
    console.error('Main branch not found! Run seed first.');
    process.exit(1);
  }

  console.log(`Main branch ID: ${mainBranch.id}\n`);

  // Fix 1: Main branch content that is published but private → make public
  const mainPrivatePublished = await db.query.contents.findMany({
    where: and(
      eq(schema.contents.branchId, mainBranch.id),
      eq(schema.contents.isPublished, true),
      eq(schema.contents.visibility, 'private')
    ),
  });

  console.log(`Found ${mainPrivatePublished.length} main branch items with visibility='private' that should be 'public'\n`);

  let fixedMain = 0;
  for (const content of mainPrivatePublished) {
    await db
      .update(schema.contents)
      .set({ visibility: 'public' })
      .where(eq(schema.contents.id, content.id));

    console.log(`  Fixed (→ public): ${content.slug} (main branch)`);
    fixedMain++;
  }

  // Fix 2: User branch content that has visibility='public' → make private
  const userBranchPublic = await db.query.contents.findMany({
    where: and(
      ne(schema.contents.branchId, mainBranch.id),
      eq(schema.contents.visibility, 'public')
    ),
  });

  console.log(`\nFound ${userBranchPublic.length} user branch items with visibility='public' that should be 'private'\n`);

  let fixedUser = 0;
  for (const content of userBranchPublic) {
    await db
      .update(schema.contents)
      .set({ visibility: 'private' })
      .where(eq(schema.contents.id, content.id));

    console.log(`  Fixed (→ private): ${content.slug} (branch: ${content.branchId})`);
    fixedUser++;
  }

  console.log(`\nFixed ${fixedMain} main branch items (→ public)`);
  console.log(`Fixed ${fixedUser} user branch items (→ private)`);
}

fixPublishedVisibility()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
  });
