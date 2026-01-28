/**
 * Migration script to retroactively publish content from already-published branches.
 *
 * Run with: npx tsx src/db/migrate-published-content.ts
 *
 * This fixes the issue where branches were published before the content merge
 * infrastructure was implemented, so their content was never copied to main.
 */

import { eq, and } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';
import {
  computeChecksum,
  computeByteSize,
  createMetadataSnapshot,
} from '../models/content.js';

async function migratePublishedContent() {
  console.log('Starting published content migration...\n');

  // Get the main branch
  const mainBranch = await db.query.branches.findFirst({
    where: eq(schema.branches.slug, 'main'),
  });

  if (!mainBranch) {
    console.error('Main branch not found! Run seed first.');
    process.exit(1);
  }

  console.log(`Main branch found: ${mainBranch.id}\n`);

  // Get all published branches (excluding main)
  const publishedBranches = await db.query.branches.findMany({
    where: and(
      eq(schema.branches.state, 'published'),
      // Exclude main branch
    ),
  });

  const userBranches = publishedBranches.filter(b => b.id !== mainBranch.id);
  console.log(`Found ${userBranches.length} published user branches\n`);

  let totalMigrated = 0;
  let totalSkipped = 0;

  for (const branch of userBranches) {
    console.log(`Processing branch: ${branch.name} (${branch.id})`);

    // Get all content in this branch
    const branchContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branch.id),
    });

    console.log(`  Found ${branchContent.length} content items`);

    for (const content of branchContent) {
      // Check if this content already exists in main (by slug)
      const existingInMain = await db.query.contents.findFirst({
        where: and(
          eq(schema.contents.branchId, mainBranch.id),
          eq(schema.contents.slug, content.slug)
        ),
      });

      if (existingInMain) {
        // Check if main's content is already published and public
        if (existingInMain.isPublished && existingInMain.visibility === 'public') {
          console.log(`  - ${content.slug}: Already exists in main (skipped)`);
          totalSkipped++;
          continue;
        }

        // Update existing main content to be published and public
        await db
          .update(schema.contents)
          .set({
            isPublished: true,
            visibility: 'public',
            publishedAt: existingInMain.publishedAt || new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.contents.id, existingInMain.id));

        console.log(`  - ${content.slug}: Updated visibility in main`);
        totalMigrated++;
        continue;
      }

      // Content doesn't exist in main - need to copy it
      const currentVersion = content.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(schema.contentVersions.id, content.currentVersionId),
          })
        : null;

      if (!currentVersion) {
        console.log(`  - ${content.slug}: No current version (skipped)`);
        totalSkipped++;
        continue;
      }

      // Create content in main branch
      await db.transaction(async (tx) => {
        const metadataSnapshot = createMetadataSnapshot({
          title: content.title,
          category: content.category ?? undefined,
          tags: content.tags ?? [],
        });

        const [newContent] = await tx
          .insert(schema.contents)
          .values({
            branchId: mainBranch.id,
            slug: content.slug,
            title: content.title,
            contentType: content.contentType,
            category: content.category,
            tags: content.tags,
            description: content.description,
            visibility: 'public',
            isPublished: true,
            publishedAt: content.publishedAt || new Date(),
            publishedBy: content.publishedBy || branch.ownerId,
            createdBy: content.createdBy,
          })
          .returning();

        const [newVersion] = await tx
          .insert(schema.contentVersions)
          .values({
            contentId: newContent.id,
            body: currentVersion.body,
            bodyFormat: currentVersion.bodyFormat,
            metadataSnapshot,
            changeDescription: 'Migrated from published branch',
            authorId: currentVersion.authorId,
            authorType: 'system',
            byteSize: currentVersion.byteSize,
            checksum: currentVersion.checksum,
          })
          .returning();

        await tx
          .update(schema.contents)
          .set({
            currentVersionId: newVersion.id,
            publishedVersionId: newVersion.id,
          })
          .where(eq(schema.contents.id, newContent.id));

        // Update the branch content to link to main
        await tx
          .update(schema.contents)
          .set({
            sourceContentId: newContent.id,
            isPublished: true,
            publishedVersionId: currentVersion.id,
            publishedAt: content.publishedAt || new Date(),
          })
          .where(eq(schema.contents.id, content.id));
      });

      console.log(`  - ${content.slug}: Copied to main`);
      totalMigrated++;
    }

    console.log('');
  }

  console.log('Migration complete!');
  console.log(`  Migrated: ${totalMigrated}`);
  console.log(`  Skipped: ${totalSkipped}`);
}

migratePublishedContent()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
