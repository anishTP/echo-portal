/**
 * Debug script to check what's in the main branch
 */

import { eq } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';

async function debug() {
  // Check all branches
  const allBranches = await db.query.branches.findMany({});
  console.log('=== All Branches ===');
  for (const b of allBranches) {
    console.log({ id: b.id, name: b.name, slug: b.slug, state: b.state });
  }

  // Get main branch
  const main = await db.query.branches.findFirst({
    where: eq(schema.branches.slug, 'main'),
  });
  console.log('\n=== Main Branch ===');
  console.log(main ? { id: main.id, name: main.name, slug: main.slug } : 'NOT FOUND');

  // Get content in main branch
  if (main) {
    const mainContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, main.id),
    });
    console.log('\n=== Content in Main Branch ===');
    console.log('Count:', mainContent.length);
    for (const c of mainContent) {
      console.log({
        id: c.id,
        title: c.title,
        slug: c.slug,
        category: c.category,
        visibility: c.visibility,
        isPublished: c.isPublished,
        archivedAt: c.archivedAt,
      });
    }
  }

  // Also check what listPublished would return
  console.log('\n=== What listPublished query returns ===');
  const published = await db.query.contents.findMany({
    where: eq(schema.contents.isPublished, true),
  });
  console.log('Total published content:', published.length);

  const publicVisible = published.filter(c => c.visibility === 'public');
  console.log('With visibility=public:', publicVisible.length);

  if (main) {
    const inMain = publicVisible.filter(c => c.branchId === main.id);
    console.log('In main branch:', inMain.length);
    for (const c of inMain) {
      console.log({ title: c.title, category: c.category });
    }
  }
}

debug()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Debug failed:', err);
    process.exit(1);
  });
