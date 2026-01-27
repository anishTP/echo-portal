import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import type { ContentReference } from '@echo-portal/shared';

export const referenceService = {
  /**
   * Get outgoing references from a content item.
   */
  async getReferences(sourceContentId: string): Promise<ContentReference[]> {
    const refs = await db.query.contentReferences.findMany({
      where: eq(schema.contentReferences.sourceContentId, sourceContentId),
    });

    return refs.map((ref) => ({
      id: ref.id,
      sourceContentId: ref.sourceContentId,
      targetContentId: ref.targetContentId,
      referenceType: ref.referenceType,
    }));
  },

  /**
   * Get incoming references (content items that reference this one).
   */
  async getReferencedBy(targetContentId: string): Promise<ContentReference[]> {
    const refs = await db.query.contentReferences.findMany({
      where: eq(schema.contentReferences.targetContentId, targetContentId),
    });

    return refs.map((ref) => ({
      id: ref.id,
      sourceContentId: ref.sourceContentId,
      targetContentId: ref.targetContentId,
      referenceType: ref.referenceType,
    }));
  },

  /**
   * Create a reference between two content items.
   */
  async createReference(input: {
    sourceContentId: string;
    sourceVersionId: string;
    targetContentId: string;
    targetVersionId?: string;
    referenceType: string;
  }): Promise<ContentReference> {
    const [ref] = await db
      .insert(schema.contentReferences)
      .values({
        sourceContentId: input.sourceContentId,
        sourceVersionId: input.sourceVersionId,
        targetContentId: input.targetContentId,
        targetVersionId: input.targetVersionId,
        referenceType: input.referenceType,
      })
      .returning();

    return {
      id: ref.id,
      sourceContentId: ref.sourceContentId,
      targetContentId: ref.targetContentId,
      referenceType: ref.referenceType,
    };
  },
};
