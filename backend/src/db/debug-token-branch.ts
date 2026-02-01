/**
 * Debug script to check Token transformer theory branch content
 */

import { eq } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from './schema/index.js';

async function debug() {
  const branchId = '8c782cd4-473d-43ad-a2c2-40f54aa23bd1';

  const branch = await db.query.branches.findFirst({
    where: eq(schema.branches.id, branchId),
  });
  console.log('=== Branch ===');
  console.log(branch);

  const contents = await db.query.contents.findMany({
    where: eq(schema.contents.branchId, branchId),
  });

  console.log('\n=== Content in Branch ===');
  console.log('Count:', contents.length);
  for (const c of contents) {
    console.log({
      id: c.id,
      title: c.title,
      slug: c.slug,
      category: c.category,
      visibility: c.visibility,
      isPublished: c.isPublished,
      sourceContentId: c.sourceContentId,
    });
  }

  // Check if any of these have sourceContentId pointing to main
  console.log('\n=== Checking sourceContentId links ===');
  for (const c of contents) {
    if (c.sourceContentId) {
      const source = await db.query.contents.findFirst({
        where: eq(schema.contents.id, c.sourceContentId),
      });
      console.log(`${c.title} -> sourceContentId: ${c.sourceContentId}`);
      if (source) {
        console.log(`  Source: ${source.title} in branch ${source.branchId}`);
      } else {
        console.log(`  Source: NOT FOUND`);
      }
    } else {
      console.log(`${c.title} -> NO sourceContentId (new content)`);
    }
  }
}

debug()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Debug failed:', err);
    process.exit(1);
  });
