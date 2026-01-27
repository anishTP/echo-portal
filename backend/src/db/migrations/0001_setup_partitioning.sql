-- Migration: Setup audit_logs table partitioning by month
-- FR-023: 7-year audit log retention with PostgreSQL range partitioning
-- Created: 2026-01-27

-- Note: This migration should be run AFTER the main Drizzle migration
-- creates the audit_logs table structure

-- 1. Convert audit_logs to partitioned table
-- (This step assumes the table already exists from Drizzle schema)

-- Drop existing audit_logs table and recreate as partitioned
-- IMPORTANT: In production, migrate data first before dropping
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Recreate as partitioned table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type actor_type NOT NULL,
  actor_ip TEXT,
  actor_user_agent TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  outcome audit_outcome NOT NULL,
  initiating_user_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  session_id TEXT
) PARTITION BY RANGE (timestamp);

-- 2. Create initial partitions (current month + 2 months ahead)
DO $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
  month_offset INT;
BEGIN
  -- Create partitions for current month, next month, and month after
  FOR month_offset IN 0..2 LOOP
    start_date := DATE_TRUNC('month', NOW() + (month_offset || ' months')::INTERVAL);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'audit_logs_' || TO_CHAR(start_date, 'YYYY_MM');

    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs
      FOR VALUES FROM (%L) TO (%L)
    ', partition_name, start_date, end_date);
  END LOOP;
END $$;

-- 3. Create indexes on partitioned table
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs (timestamp);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);

-- 4. Create function to automatically create future partitions
CREATE OR REPLACE FUNCTION create_audit_log_partition()
RETURNS void AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
BEGIN
  -- Create partition for 3 months ahead (ensures we always have future partitions)
  start_date := DATE_TRUNC('month', NOW() + INTERVAL '3 months');
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'audit_logs_' || TO_CHAR(start_date, 'YYYY_MM');

  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = partition_name
  ) THEN
    EXECUTE format('
      CREATE TABLE %I PARTITION OF audit_logs
      FOR VALUES FROM (%L) TO (%L)
    ', partition_name, start_date, end_date);

    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Create scheduled job to create partitions monthly
-- Note: This requires pg_cron extension. If unavailable, create partitions manually or via cron job.
-- Uncomment the following if pg_cron is available:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('create-audit-partitions', '0 0 1 * *', 'SELECT create_audit_log_partition()');

-- Alternative: Call create_audit_log_partition() from application monthly

-- 6. Create function to drop old partitions (for 7+ year retention cleanup)
CREATE OR REPLACE FUNCTION drop_old_audit_partitions(retention_years INT DEFAULT 7)
RETURNS void AS $$
DECLARE
  partition_record RECORD;
  cutoff_date DATE;
BEGIN
  cutoff_date := DATE_TRUNC('month', NOW() - (retention_years || ' years')::INTERVAL);

  FOR partition_record IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'audit_logs_%'
    AND tablename != 'audit_logs'
  LOOP
    -- Extract date from partition name (audit_logs_YYYY_MM)
    DECLARE
      partition_date DATE;
      date_str TEXT;
    BEGIN
      date_str := REPLACE(partition_record.tablename, 'audit_logs_', '');
      date_str := REPLACE(date_str, '_', '-') || '-01';
      partition_date := date_str::DATE;

      IF partition_date < cutoff_date THEN
        EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
        RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not process partition: %', partition_record.tablename;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. Comments for maintenance
COMMENT ON TABLE audit_logs IS 'Audit log table partitioned by month for 7-year retention (FR-023)';
COMMENT ON FUNCTION create_audit_log_partition() IS 'Creates next month partition for audit_logs. Run monthly.';
COMMENT ON FUNCTION drop_old_audit_partitions(INT) IS 'Drops audit_log partitions older than N years (default 7). Run annually.';
