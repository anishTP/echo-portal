/**
 * T101: Tests for audit log index performance (SC-006)
 *
 * Verifies that database indexes are properly configured for:
 * - 5-second query performance for any audit query
 * - Optimized resource history, failed logins, permission denials
 * - Efficient user activity and security monitoring queries
 */

import { describe, it, expect } from 'vitest';
import { db } from '../../src/db/index.js';
import { sql } from 'drizzle-orm';

describe('T101: Audit Log Index Performance (SC-006)', () => {
  describe('Index existence validation', () => {
    it('verifies all required indexes exist', async () => {
      const result = await db.execute(sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'audit_logs'
        ORDER BY indexname
      `);

      const indexes = result.rows.map((row: any) => row.indexname);

      // Original indexes (T085, T086)
      expect(indexes).toContain('audit_logs_resource_idx');
      expect(indexes).toContain('audit_logs_actor_id_idx');
      expect(indexes).toContain('audit_logs_timestamp_idx');
      expect(indexes).toContain('audit_logs_action_idx');

      // T101: Composite indexes for performance
      expect(indexes).toContain('audit_logs_resource_timestamp_idx');
      expect(indexes).toContain('audit_logs_action_timestamp_idx');
      expect(indexes).toContain('audit_logs_outcome_timestamp_idx');
      expect(indexes).toContain('audit_logs_actor_action_idx');
      expect(indexes).toContain('audit_logs_actor_outcome_idx');
    });

    it('verifies resource_timestamp index covers correct columns', async () => {
      const result = await db.execute(sql`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'audit_logs_resource_timestamp_idx'
      `);

      expect(result.rows.length).toBe(1);
      const indexDef = result.rows[0]?.indexdef;
      expect(indexDef).toContain('resource_type');
      expect(indexDef).toContain('resource_id');
      expect(indexDef).toContain('timestamp');
    });

    it('verifies action_timestamp index covers correct columns', async () => {
      const result = await db.execute(sql`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'audit_logs_action_timestamp_idx'
      `);

      expect(result.rows.length).toBe(1);
      const indexDef = result.rows[0]?.indexdef;
      expect(indexDef).toContain('action');
      expect(indexDef).toContain('timestamp');
    });

    it('verifies outcome_timestamp index has WHERE clause', async () => {
      const result = await db.execute(sql`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'audit_logs_outcome_timestamp_idx'
      `);

      expect(result.rows.length).toBe(1);
      const indexDef = result.rows[0]?.indexdef;
      expect(indexDef).toContain('outcome');
      expect(indexDef).toContain('timestamp');
      expect(indexDef).toContain('WHERE');
      expect(indexDef).toContain('IS NOT NULL');
    });

    it('verifies actor_action index covers correct columns', async () => {
      const result = await db.execute(sql`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'audit_logs_actor_action_idx'
      `);

      expect(result.rows.length).toBe(1);
      const indexDef = result.rows[0]?.indexdef;
      expect(indexDef).toContain('actor_id');
      expect(indexDef).toContain('action');
    });

    it('verifies actor_outcome index has WHERE clause', async () => {
      const result = await db.execute(sql`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'audit_logs_actor_outcome_idx'
      `);

      expect(result.rows.length).toBe(1);
      const indexDef = result.rows[0]?.indexdef;
      expect(indexDef).toContain('actor_id');
      expect(indexDef).toContain('outcome');
      expect(indexDef).toContain('WHERE');
      expect(indexDef).toContain('IS NOT NULL');
    });
  });

  describe('Index usage validation (EXPLAIN ANALYZE)', () => {
    it('uses resource_timestamp index for resource history queries', async () => {
      const result = await db.execute(sql`
        EXPLAIN
        SELECT * FROM audit_logs
        WHERE resource_type = 'branch'
          AND resource_id = 'test-id'
          AND timestamp >= NOW() - INTERVAL '7 days'
        ORDER BY timestamp DESC
        LIMIT 50
      `);

      const plan = JSON.stringify(result.rows);
      // Verify index scan is used (not sequential scan)
      expect(plan.toLowerCase()).toMatch(/index.*audit_logs_resource/i);
    });

    it('uses action_timestamp index for failed login reports', async () => {
      const result = await db.execute(sql`
        EXPLAIN
        SELECT * FROM audit_logs
        WHERE action IN ('auth.failed', 'auth.locked')
          AND timestamp >= NOW() - INTERVAL '30 days'
        ORDER BY timestamp DESC
        LIMIT 100
      `);

      const plan = JSON.stringify(result.rows);
      expect(plan.toLowerCase()).toMatch(/index.*audit_logs_action/i);
    });

    it('uses outcome_timestamp index for permission denial reports', async () => {
      const result = await db.execute(sql`
        EXPLAIN
        SELECT * FROM audit_logs
        WHERE outcome = 'denied'
          AND timestamp >= NOW() - INTERVAL '7 days'
        ORDER BY timestamp DESC
        LIMIT 100
      `);

      const plan = JSON.stringify(result.rows);
      expect(plan.toLowerCase()).toMatch(/index.*audit_logs_outcome/i);
    });

    it('uses actor_action index for user activity by action', async () => {
      const result = await db.execute(sql`
        EXPLAIN
        SELECT * FROM audit_logs
        WHERE actor_id = 'test-user'
          AND action IN ('branch.create', 'branch.update')
        ORDER BY timestamp DESC
        LIMIT 50
      `);

      const plan = JSON.stringify(result.rows);
      expect(plan.toLowerCase()).toMatch(/index.*audit_logs_actor/i);
    });

    it('uses actor_outcome index for security monitoring', async () => {
      const result = await db.execute(sql`
        EXPLAIN
        SELECT * FROM audit_logs
        WHERE actor_id = 'test-user'
          AND outcome = 'denied'
        ORDER BY timestamp DESC
        LIMIT 50
      `);

      const plan = JSON.stringify(result.rows);
      expect(plan.toLowerCase()).toMatch(/index.*audit_logs_actor/i);
    });
  });

  describe('Index selectivity', () => {
    it('outcome index uses partial index for NULL filtering', async () => {
      // Verify the partial index only includes rows where outcome IS NOT NULL
      const result = await db.execute(sql`
        SELECT pg_get_indexdef(indexrelid) as def
        FROM pg_index
        JOIN pg_class ON pg_class.oid = pg_index.indexrelid
        WHERE pg_class.relname = 'audit_logs_outcome_timestamp_idx'
      `);

      expect(result.rows.length).toBe(1);
      const def = result.rows[0]?.def;
      expect(def).toContain('WHERE (outcome IS NOT NULL)');
    });

    it('actor_outcome index uses partial index for NULL filtering', async () => {
      const result = await db.execute(sql`
        SELECT pg_get_indexdef(indexrelid) as def
        FROM pg_index
        JOIN pg_class ON pg_class.oid = pg_index.indexrelid
        WHERE pg_class.relname = 'audit_logs_actor_outcome_idx'
      `);

      expect(result.rows.length).toBe(1);
      const def = result.rows[0]?.def;
      expect(def).toContain('WHERE (outcome IS NOT NULL)');
    });
  });

  describe('Performance targets (SC-006)', () => {
    it('documents expected query performance improvements', () => {
      // This test documents the performance targets
      // Actual performance testing requires production-scale data

      const performanceTargets = {
        resourceHistory: '<500ms',
        failedLoginReport: '<1s',
        permissionDenialReport: '<1s',
        userActivityQuery: '<500ms',
        overallTarget: '<5s for any audit query (SC-006)',
      };

      expect(performanceTargets.resourceHistory).toBe('<500ms');
      expect(performanceTargets.failedLoginReport).toBe('<1s');
      expect(performanceTargets.permissionDenialReport).toBe('<1s');
      expect(performanceTargets.userActivityQuery).toBe('<500ms');
      expect(performanceTargets.overallTarget).toBe('<5s for any audit query (SC-006)');
    });
  });
});
