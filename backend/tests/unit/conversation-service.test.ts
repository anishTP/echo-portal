import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationService } from '../../src/services/ai/conversation-service';

// Mock database
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    $count: vi.fn(),
  },
}));

vi.mock('../../src/db/schema/ai-conversations', () => ({
  aiConversations: {
    id: 'id',
    userId: 'userId',
    branchId: 'branchId',
    sessionId: 'sessionId',
    status: 'status',
    turnCount: 'turnCount',
    maxTurns: 'maxTurns',
    updatedAt: 'updatedAt',
    endReason: 'endReason',
    expiresAt: 'expiresAt',
    createdAt: 'createdAt',
  },
}));

vi.mock('../../src/db/schema/ai-requests', () => ({
  aiRequests: {
    id: 'id',
    conversationId: 'conversationId',
    userId: 'userId',
    branchId: 'branchId',
    status: 'status',
    resolvedAt: 'resolvedAt',
    resolvedBy: 'resolvedBy',
    createdAt: 'createdAt',
  },
}));

// Mock audit logger
vi.mock('../../src/services/audit/logger', () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { db } from '../../src/db';

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConversationService();
  });

  describe('create()', () => {
    it('creates a new conversation after ending any existing active one', async () => {
      const mockConversation = {
        id: 'conv-1',
        userId: 'user-1',
        branchId: 'branch-1',
        sessionId: 'session-1',
        status: 'active',
        turnCount: 0,
        maxTurns: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      // Mock getActive (no existing)
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockConversation]),
        }),
      });

      const result = await service.create({
        userId: 'user-1',
        branchId: 'branch-1',
        sessionId: 'session-1',
        expiresAt: new Date(Date.now() + 86400000),
      });

      expect(result.id).toBe('conv-1');
      expect(result.status).toBe('active');
      expect(result.turnCount).toBe(0);
    });
  });

  describe('getById()', () => {
    it('returns conversation when found', async () => {
      const mockConversation = {
        id: 'conv-1',
        userId: 'user-1',
        status: 'active',
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockConversation]),
          }),
        }),
      });

      const result = await service.getById('conv-1');
      expect(result).toEqual(mockConversation);
    });

    it('returns null when not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('hasRemainingTurns()', () => {
    it('returns true when turns are available', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ turnCount: 5, maxTurns: 20 }]),
          }),
        }),
      });

      expect(await service.hasRemainingTurns('conv-1')).toBe(true);
    });

    it('returns false when at turn limit', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ turnCount: 20, maxTurns: 20 }]),
          }),
        }),
      });

      expect(await service.hasRemainingTurns('conv-1')).toBe(false);
    });

    it('returns false when conversation not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      expect(await service.hasRemainingTurns('nonexistent')).toBe(false);
    });
  });

  describe('end()', () => {
    it('ends an active conversation and discards pending requests', async () => {
      const mockConversation = {
        id: 'conv-1',
        userId: 'user-1',
        branchId: 'branch-1',
        status: 'active',
        turnCount: 5,
      };

      // Mock getById
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockConversation]),
          }),
        }),
      });

      // Mock update (for discarding pending + ending conversation)
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await service.end('conv-1', 'explicit_clear', 'user-1');

      expect(db.update).toHaveBeenCalled();
    });

    it('does nothing if conversation is already ended', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'conv-1', status: 'ended' }]),
          }),
        }),
      });

      await service.end('conv-1', 'explicit_clear');
      // update should not be called for conversation state
      expect(db.update).not.toHaveBeenCalled();
    });

    it('does nothing if conversation not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.end('nonexistent', 'explicit_clear');
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpired()', () => {
    it('ends all expired active conversations and returns count', async () => {
      const expired = [{ id: 'conv-1' }, { id: 'conv-2' }];

      // First call: select expired
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(expired),
        }),
      });

      // Subsequent calls for each end() → getById
      for (const conv of expired) {
        (db.select as any).mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ ...conv, status: 'active', userId: 'user-1', branchId: 'branch-1', turnCount: 3 }]),
            }),
          }),
        });
      }

      // Mock update for discardPending + end
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const count = await service.cleanupExpired();
      expect(count).toBe(2);
    });
  });
});
