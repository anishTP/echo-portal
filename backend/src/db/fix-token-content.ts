/**
 * Fix script to manually update Token Transformation Theory content in main
 */

import { eq } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';

async function fix() {
  // The Token Transformation Theory content in the branch
  const branchContentId = '514e29ae-4dcf-443d-9ea1-f3c05a0d95d9';

  // The source content in main that needs to be updated
  const mainContentId = 'ae0c57cb-7fbf-491d-8b5b-581038754c7f';

  // Get the branch content
  const branchContent = await db.query.contents.findFirst({
    where: eq(schema.contents.id, branchContentId),
  });

  if (!branchContent) {
    console.error('Branch content not found!');
    process.exit(1);
  }

  console.log('Branch content:');
  console.log({
    title: branchContent.title,
    category: branchContent.category,
    slug: branchContent.slug,
  });

  // Get the current version body from branch
  const branchVersion = branchContent.currentVersionId
    ? await db.query.contentVersions.findFirst({
        where: eq(schema.contentVersions.id, branchContent.currentVersionId),
      })
    : null;

  // Get the main content
  const mainContent = await db.query.contents.findFirst({
    where: eq(schema.contents.id, mainContentId),
  });

  if (!mainContent) {
    console.error('Main content not found!');
    process.exit(1);
  }

  console.log('\nMain content (before):');
  console.log({
    title: mainContent.title,
    category: mainContent.category,
    slug: mainContent.slug,
  });

  // Update main content with branch content data
  await db
    .update(schema.contents)
    .set({
      title: branchContent.title,
      category: branchContent.category,
      tags: branchContent.tags,
      description: branchContent.description,
      visibility: 'public',
      isPublished: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.contents.id, mainContentId));

  // If we have a new body, create a new version
  if (branchVersion) {
    const [newVersion] = await db
      .insert(schema.contentVersions)
      .values({
        contentId: mainContentId,
        parentVersionId: mainContent.currentVersionId,
        body: branchVersion.body,
        bodyFormat: branchVersion.bodyFormat,
        metadataSnapshot: {
          title: branchContent.title,
          category: branchContent.category,
          tags: branchContent.tags || [],
        },
        changeDescription: 'Merged from Token transformer theory branch',
        authorId: mainContent.createdBy,
        authorType: 'user',
        byteSize: branchVersion.byteSize,
        checksum: branchVersion.checksum,
      })
      .returning();

    // Update main content to point to new version
    await db
      .update(schema.contents)
      .set({ currentVersionId: newVersion.id, publishedVersionId: newVersion.id })
      .where(eq(schema.contents.id, mainContentId));

    console.log('\nCreated new version:', newVersion.id);
  }

  // Verify the update
  const updatedMain = await db.query.contents.findFirst({
    where: eq(schema.contents.id, mainContentId),
  });

  console.log('\nMain content (after):');
  console.log({
    title: updatedMain?.title,
    category: updatedMain?.category,
    slug: updatedMain?.slug,
    visibility: updatedMain?.visibility,
  });

  console.log('\nDone!');
}

fix()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
  });
