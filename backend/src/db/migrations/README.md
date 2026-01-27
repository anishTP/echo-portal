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

## Migration Order

1. Generate Drizzle migration: `pnpm drizzle-kit generate`
2. Apply Drizzle migration: `pnpm drizzle-kit push` or `pnpm drizzle-kit migrate`
3. Apply custom partitioning migration: `psql -f 0001_setup_partitioning.sql`

## Notes

- The `role` enum migration from `publisher` to `viewer`/`administrator` may require a data migration step
- Audit log partitioning should be set up before the table receives significant write traffic
- Monthly partition creation can be automated via pg_cron or application-level scheduler
