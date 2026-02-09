import { db } from '../../db/index.js';
import { aiContextDocuments } from '../../db/schema/ai-context-documents.js';
import { eq, asc } from 'drizzle-orm';
import type { AIContextDocument } from '../../db/schema/ai-context-documents.js';

export class AIContextDocumentService {
  /** List all context documents ordered by sortOrder (admin view) */
  async list(): Promise<AIContextDocument[]> {
    return db
      .select()
      .from(aiContextDocuments)
      .orderBy(asc(aiContextDocuments.sortOrder), asc(aiContextDocuments.createdAt));
  }

  /** Get only enabled context documents ordered by sortOrder (for prompt injection) */
  async getEnabled(): Promise<AIContextDocument[]> {
    return db
      .select()
      .from(aiContextDocuments)
      .where(eq(aiContextDocuments.enabled, true))
      .orderBy(asc(aiContextDocuments.sortOrder), asc(aiContextDocuments.createdAt));
  }

  /** Get a single context document by ID */
  async getById(id: string): Promise<AIContextDocument | undefined> {
    const results = await db
      .select()
      .from(aiContextDocuments)
      .where(eq(aiContextDocuments.id, id))
      .limit(1);
    return results[0];
  }

  /** Create a new context document */
  async create(
    data: { title: string; content: string; sortOrder?: number },
    userId: string
  ): Promise<AIContextDocument> {
    const [doc] = await db
      .insert(aiContextDocuments)
      .values({
        title: data.title,
        content: data.content,
        sortOrder: data.sortOrder ?? 0,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    return doc;
  }

  /** Update an existing context document */
  async update(
    id: string,
    data: { title?: string; content?: string; enabled?: boolean; sortOrder?: number },
    userId: string
  ): Promise<AIContextDocument | undefined> {
    const results = await db
      .update(aiContextDocuments)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(aiContextDocuments.id, id))
      .returning();
    return results[0];
  }

  /** Delete a context document (hard delete) */
  async delete(id: string): Promise<boolean> {
    const results = await db
      .delete(aiContextDocuments)
      .where(eq(aiContextDocuments.id, id))
      .returning({ id: aiContextDocuments.id });
    return results.length > 0;
  }
}

export const aiContextDocumentService = new AIContextDocumentService();
