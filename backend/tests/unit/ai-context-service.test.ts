import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock schema
vi.mock('../../src/db/schema/ai-context-documents', () => ({
  aiContextDocuments: {
    id: 'id',
    title: 'title',
    content: 'content',
    enabled: 'enabled',
    sortOrder: 'sortOrder',
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

// Mock drizzle-orm operators (used by the service)
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  asc: vi.fn((col: unknown) => ({ op: 'asc', col })),
}));

import { db } from '../../src/db';
import { AIContextDocumentService } from '../../src/services/ai/ai-context-service';

describe('AIContextDocumentService', () => {
  let service: AIContextDocumentService;

  const mockDoc = {
    id: 'doc-1',
    title: 'Brand Guidelines',
    content: 'Use formal tone.',
    enabled: true,
    sortOrder: 0,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockDoc2 = {
    id: 'doc-2',
    title: 'Style Guide',
    content: 'Use active voice.',
    enabled: true,
    sortOrder: 1,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIContextDocumentService();
  });

  describe('list()', () => {
    it('returns all documents ordered by sortOrder', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([mockDoc, mockDoc2]),
        }),
      });

      const result = await service.list();

      expect(result).toEqual([mockDoc, mockDoc2]);
      expect(result).toHaveLength(2);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('getEnabled()', () => {
    it('returns only enabled documents', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockDoc, mockDoc2]),
          }),
        }),
      });

      const result = await service.getEnabled();

      expect(result).toEqual([mockDoc, mockDoc2]);
      expect(result).toHaveLength(2);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('getById()', () => {
    it('returns a document by id', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDoc]),
          }),
        }),
      });

      const result = await service.getById('doc-1');

      expect(result).toEqual(mockDoc);
      expect(db.select).toHaveBeenCalled();
    });

    it('returns undefined when document is not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getById('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('create()', () => {
    it('inserts a new document and returns it', async () => {
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockDoc]),
        }),
      });

      const result = await service.create(
        { title: 'Brand Guidelines', content: 'Use formal tone.' },
        'user-1'
      );

      expect(result).toEqual(mockDoc);
      expect(db.insert).toHaveBeenCalled();
    });

    it('uses provided sortOrder when given', async () => {
      const mockValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...mockDoc, sortOrder: 5 }]),
      });
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      const result = await service.create(
        { title: 'Brand Guidelines', content: 'Use formal tone.', sortOrder: 5 },
        'user-1'
      );

      expect(result.sortOrder).toBe(5);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 5 })
      );
    });

    it('defaults sortOrder to 0 when not provided', async () => {
      const mockValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockDoc]),
      });
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      await service.create(
        { title: 'Brand Guidelines', content: 'Use formal tone.' },
        'user-1'
      );

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 0 })
      );
    });
  });

  describe('update()', () => {
    it('updates a document and returns it', async () => {
      const updatedDoc = { ...mockDoc, title: 'Updated Title', updatedAt: new Date() };

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedDoc]),
          }),
        }),
      });

      const result = await service.update(
        'doc-1',
        { title: 'Updated Title' },
        'user-1'
      );

      expect(result).toEqual(updatedDoc);
      expect(result!.title).toBe('Updated Title');
      expect(db.update).toHaveBeenCalled();
    });

    it('returns undefined when document is not found', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.update(
        'nonexistent',
        { title: 'Updated Title' },
        'user-1'
      );

      expect(result).toBeUndefined();
    });
  });

  describe('delete()', () => {
    it('returns true when document is deleted', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'doc-1' }]),
        }),
      });

      const result = await service.delete('doc-1');

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it('returns false when document is not found', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
