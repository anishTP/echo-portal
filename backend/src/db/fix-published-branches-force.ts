/**
 * Force merge content from ALL published branches into main.
 *
 * Run with: npx tsx src/db/fix-published-branches-force.ts
 *
 * This is a more aggressive fix that merges all content regardless
 * of whether we think it's already merged. The mergeContentIntoMain
 * function handles duplicates properly.
 */

import { eq, and, ne } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';
import { contentMergeService } from '../services/content/content-merge-service.js';

async function fixPublishedBranchesForce() {
  console.log('Force merging all published branch content to main...\n');

  // Get the main branch
  const mainBranch = await db.query.branches.findFirst({
    where: eq(schema.branches.slug, 'main'),
  });

  if (!mainBranch) {
    console.error('Main branch not found! Run seed first.');
    process.exit(1);
  }

  console.log(`Main branch ID: ${mainBranch.id}\n`);

  // Get all published branches (excluding main)
  const publishedBranches = await db.query.branches.findMany({
    where: and(
      eq(schema.branches.state, 'published'),
      ne(schema.branches.id, mainBranch.id)
    ),
  });

  console.log(`Found ${publishedBranches.length} published user branches\n`);

  let merged = 0;
  let skipped = 0;
  let failed = 0;

  for (const branch of publishedBranches) {
    console.log(`Processing branch: ${branch.name} (${branch.id})`);

    // Get content in this branch
    const branchContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branch.id),
    });

    if (branchContent.length === 0) {
      console.log(`  No content in branch, skipping`);
      skipped++;
      continue;
    }

    console.log(`  Found ${branchContent.length} content items, merging...`);

    try {
      const result = await contentMergeService.mergeContentIntoMain(
        branch.id,
        mainBranch.id,
        branch.ownerId
      );

      if (result.success) {
        console.log(`  ✓ Merged ${result.mergedCount} items`);
        if (result.mergedCount > 0) {
          merged++;
        } else {
          skipped++;
        }
      } else {
        console.log(`  ✗ Merge failed: ${result.conflictCount} conflicts`);
        for (const conflict of result.conflicts) {
          console.log(`    - ${conflict.slug}: ${conflict.description}`);
        }
        failed++;
      }
    } catch (error) {
      console.error(`  ✗ Error merging:`, error);
      failed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Merged: ${merged}`);
  console.log(`Skipped (no changes): ${skipped}`);
  console.log(`Failed: ${failed}`);

  // Also fix visibility on any main branch content that's not public
  console.log(`\n--- Fixing main branch visibility ---`);

  const mainContentPrivate = await db.query.contents.findMany({
    where: and(
      eq(schema.contents.branchId, mainBranch.id),
      eq(schema.contents.isPublished, true),
      ne(schema.contents.visibility, 'public')
    ),
  });

  console.log(`Found ${mainContentPrivate.length} main branch items with wrong visibility`);

  for (const content of mainContentPrivate) {
    await db
      .update(schema.contents)
      .set({ visibility: 'public' })
      .where(eq(schema.contents.id, content.id));
    console.log(`  Fixed: ${content.slug}`);
  }

  console.log(`\nDone!`);
}

fixPublishedBranchesForce()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
  });
