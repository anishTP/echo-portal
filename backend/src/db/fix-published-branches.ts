/**
 * Fix script to merge content from published branches into main.
 *
 * Run with: npx tsx src/db/fix-published-branches.ts
 *
 * This fixes branches that were published without going through convergence,
 * which left their content in the user branch without merging to main.
 */

import { eq, and, ne } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';
import { contentMergeService } from '../services/content/content-merge-service.js';

async function fixPublishedBranches() {
  console.log('Fixing published branches with unmerged content...\n');

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

    // Check if content already exists in main (by sourceContentId or slug)
    let needsMerge = false;
    for (const content of branchContent) {
      if (content.sourceContentId) {
        // Content has sourceContentId - check if main was updated
        const mainContent = await db.query.contents.findFirst({
          where: eq(schema.contents.id, content.sourceContentId),
        });

        if (mainContent && mainContent.visibility !== 'public') {
          needsMerge = true;
          break;
        }
      } else {
        // New content - check if it exists in main by slug
        const existingInMain = await db.query.contents.findFirst({
          where: and(
            eq(schema.contents.branchId, mainBranch.id),
            eq(schema.contents.slug, content.slug)
          ),
        });

        if (!existingInMain) {
          needsMerge = true;
          break;
        }
      }
    }

    if (!needsMerge) {
      console.log(`  Content already merged to main, skipping`);
      skipped++;
      continue;
    }

    // Merge content to main
    console.log(`  Merging ${branchContent.length} content items to main...`);

    try {
      const result = await contentMergeService.mergeContentIntoMain(
        branch.id,
        mainBranch.id,
        branch.ownerId
      );

      if (result.success) {
        console.log(`  ✓ Merged ${result.mergedCount} items`);
        merged++;
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
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

fixPublishedBranches()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
  });
