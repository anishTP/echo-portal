# Database Migrations

## Overview

This directory contains database migrations for the Echo Portal project.

## Migration Types

1. **Drizzle Migrations** (`backend/drizzle/`): Auto-generated from schema changes
2. **Custom SQL Migrations** (this directory): Manual migrations for complex operations

## Setup Process (Phase 1: Setup)

### T001: Generate Drizzle Migration

Run from the `backend/` directory:

```bash
pnpm drizzle-kit generate
```

This will generate SQL migration files in `backend/drizzle/` based on schema changes:
- New tables: `sessions`, `login_attempts`
- Extended tables: `users` (lockout fields), `branches` (collaboration fields), `audit_logs` (outcome, initiating_user_id)
- Updated enums: `role` enum (viewer, contributor, reviewer, administrator), `audit_outcome` enum

### T013: Apply Partitioning Migration

After applying the Drizzle migration, run the custom partitioning migration:

```bash
psql $DATABASE_URL -f backend/src/db/migrations/0001_setup_partitioning.sql
```

This sets up:
- Monthly range partitioning for `audit_logs` table
- Automatic partition creation function
- 7-year retention management function
- Base indexes for query performance

### T101: Apply Performance Indexes Migration (Phase 10: Polish)

To optimize audit log queries for 5-second performance (SC-006):

```bash
psql $DATABASE_URL -f backend/src/db/migrations/0002_audit_log_performance_indexes.sql
```

This adds composite indexes for:
- Resource history with date ranges
- Failed login reports (action + timestamp)
- Permission denial reports (outcome + timestamp)
- User activity by action type
- Security monitoring (denied actions by user)

**Note:** If partitioning (0001) is already applied, these indexes are automatically created on the partitioned table. Run 0002 migration only for existing non-partitioned tables or to verify indexes exist.

## Migration Order

1. Generate Drizzle migration: `pnpm drizzle-kit generate`
2. Apply Drizzle migration: `pnpm drizzle-kit push` or `pnpm drizzle-kit migrate`
3. Apply custom partitioning migration: `psql -f 0001_setup_partitioning.sql`
4. (Optional) Apply performance indexes: `psql -f 0002_audit_log_performance_indexes.sql`

## Audit Log Query Performance

### Indexes

The audit_logs table has 9 indexes optimized for different query patterns:

**Basic Indexes (T085, T086):**
- `audit_logs_resource_idx` - (resource_type, resource_id)
- `audit_logs_actor_id_idx` - (actor_id)
- `audit_logs_timestamp_idx` - (timestamp)
- `audit_logs_action_idx` - (action)

**Composite Indexes (T101 - SC-006):**
- `audit_logs_resource_timestamp_idx` - (resource_type, resource_id, timestamp DESC)
- `audit_logs_action_timestamp_idx` - (action, timestamp DESC)
- `audit_logs_outcome_timestamp_idx` - (outcome, timestamp DESC) WHERE outcome IS NOT NULL
- `audit_logs_actor_action_idx` - (actor_id, action)
- `audit_logs_actor_outcome_idx` - (actor_id, outcome) WHERE outcome IS NOT NULL

### Performance Targets (SC-006)

- Resource history queries: <500ms
- Failed login reports: <1s
- Permission denial reports: <1s
- User activity queries: <500ms
- Overall query performance: <5s for any audit query

## Notes

- The `role` enum migration from `publisher` to `viewer`/`administrator` may require a data migration step
- Audit log partitioning should be set up before the table receives significant write traffic
- Monthly partition creation can be automated via pg_cron or application-level scheduler
