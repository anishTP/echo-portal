/**
 * Script to archive all published branches.
 *
 * Run with: npx tsx src/db/archive-published-branches.ts
 *
 * Published branches should be archived to prevent further edits.
 * This script archives any existing published branches that weren't
 * auto-archived (created before auto-archive was implemented).
 */

import { eq, and, ne } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';

async function archivePublishedBranches() {
  console.log('Archiving published branches...\n');

  // Get the main branch (should not be archived)
  const mainBranch = await db.query.branches.findFirst({
    where: eq(schema.branches.slug, 'main'),
  });

  if (!mainBranch) {
    console.error('Main branch not found!');
    process.exit(1);
  }

  console.log(`Main branch ID: ${mainBranch.id} (will be excluded)\n`);

  // Get all published branches (excluding main)
  const publishedBranches = await db.query.branches.findMany({
    where: and(
      eq(schema.branches.state, 'published'),
      ne(schema.branches.id, mainBranch.id)
    ),
  });

  console.log(`Found ${publishedBranches.length} published branches to archive\n`);

  if (publishedBranches.length === 0) {
    console.log('No branches to archive.');
    return;
  }

  const now = new Date();
  let archived = 0;

  for (const branch of publishedBranches) {
    console.log(`Archiving: ${branch.name} (${branch.id})`);

    await db
      .update(schema.branches)
      .set({
        state: 'archived',
        archivedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.branches.id, branch.id));

    // Record the transition in the audit log
    await db.insert(schema.branchStateTransitions).values({
      branchId: branch.id,
      fromState: 'published',
      toState: 'archived',
      actorId: branch.ownerId,
      actorType: 'system',
      reason: 'Auto-archived: published branches cannot be edited',
    });

    console.log(`  ✓ Archived`);
    archived++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Archived: ${archived} branches`);
}

archivePublishedBranches()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Archive failed:', err);
    process.exit(1);
  });
