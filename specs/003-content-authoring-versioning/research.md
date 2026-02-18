# Research: Content Authoring and Versioning

**Branch**: `003-content-authoring-versioning` | **Date**: 2026-01-27

## Overview

This document captures technology decisions and research findings for the Content Authoring and Versioning feature. Each section addresses a key technical decision point identified during planning.

---

## 1. Content Storage Strategy

### Decision: PostgreSQL (text + JSONB)

### Rationale
- **Consistency**: All other entities (branches, reviews, audit logs) already live in PostgreSQL. Keeping content in the same store simplifies transactions, joins, and backup/restore.
- **Full-text search**: PostgreSQL's `tsvector` + GIN indexes support full-text search across content body, title, tags, and description without adding an external search service.
- **JSONB for metadata snapshots**: Each version freezes metadata at creation time. JSONB columns allow flexible structured storage without schema migration for every metadata field change.
- **Transactional safety**: Content creation and version insertion happen in a single database transaction, guaranteeing atomicity (no content without its initial version).

### Alternatives Considered

| Strategy | Pros | Cons | Verdict |
|----------|------|------|---------|
| **PostgreSQL (text + JSONB)** | Transactional, full-text search, no new infra, consistent with existing stack | 50 MB content rows are large; TOAST handles this but adds I/O | **Selected** |
| **Git-only (files in repo)** | Natural versioning, diffing built-in, leverages existing git service | Complex to query/search, no relational joins, slow metadata lookups | Not suitable for structured queries |
| **PostgreSQL metadata + S3/object storage for bodies** | Scales large content better, cheaper storage | Adds infrastructure dependency, two-phase writes, no transactional atomicity | Premature for current scale |
| **MongoDB** | Natural document storage, flexible schema | New infrastructure, no existing integration, weaker transactional guarantees | Unnecessary complexity |

### Implementation Notes
- PostgreSQL TOAST automatically compresses and out-of-lines large text values (> 2 KB), so storing content bodies as TEXT is efficient for the common case (most design guidelines are < 1 MB).
- The 50 MB limit (FR-025) is enforced at the application layer via `byte_size` validation, not a database constraint, to provide clear error messages.
- Content body is excluded from list queries (SELECT only metadata fields) to keep list operations fast.

---

## 2. Version Identification Strategy

### Decision: ISO 8601 Timestamps (per spec clarification)

### Rationale
- **Spec requirement**: Clarification session explicitly chose timestamp-based versioning (FR-024).
- **Natural ordering**: Timestamps are inherently chronological, making version history queries trivial (`ORDER BY version_timestamp DESC`).
- **Human-readable**: ISO 8601 strings like `2026-01-27T14:30:00.000Z` are meaningful to users viewing version history.
- **Globally unique within content**: The UNIQUE constraint `(content_id, version_timestamp)` prevents collisions. Millisecond precision and retry logic handle the edge case of near-simultaneous saves.

### Alternatives Considered

| Strategy | Pros | Cons | Verdict |
|----------|------|------|---------|
| **ISO 8601 timestamps** | Human-readable, naturally ordered, spec-mandated | Collision risk (mitigated by millisecond retry) | **Selected (per spec)** |
| **Sequential integers** | Simple, no collision risk, compact | Requires sequence management per content item, less informative | Not selected |
| **UUIDs (v7)** | Globally unique, sortable (v7) | Not human-readable, overkill for per-content versioning | Not selected |
| **Semantic versioning** | Meaningful for software | Overly complex for content; requires manual major/minor decisions | Not appropriate |

### Implementation Notes
- `version_timestamp` stored as `TIMESTAMPTZ` in PostgreSQL (microsecond precision).
- Application layer generates timestamps with millisecond precision using `new Date().toISOString()`.
- On UNIQUE constraint violation (collision), the service retries with +1 millisecond offset (maximum 3 retries).
- UUID `id` column still serves as the primary key for foreign key references; `version_timestamp` is the user-facing identifier.

---

## 3. Content Diffing Approach

### Decision: Line-based text diff (custom service using diff-match-patch algorithm)

### Rationale
- **Content type**: Design guidelines are primarily markdown text. Line-based diffing is the standard for text content.
- **Simplicity**: Line-based diff is well-understood, efficient, and produces output that users can easily interpret.
- **Metadata diffing**: Structural metadata changes (title, category, tags) are compared as field-level diffs, not text diffs.

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Line-based text diff** | Standard for text, efficient, readable output | Doesn't understand semantic structure (e.g., markdown headings) | **Selected** |
| **Git diff (via isomorphic-git)** | Leverages existing git service, proven algorithm | Requires content to be in git; adds complexity for DB-stored content | Unnecessary coupling |
| **AST-based diff** | Semantic awareness of markdown structure | Complex implementation, overkill for initial release | Deferred to future enhancement |
| **Character-level diff (diff-match-patch)** | Fine-grained, handles inline changes well | Noisy output for large content, harder to present in UI | Too granular |

### Implementation Notes
- Use a simple line-split → longest-common-subsequence approach for body diff.
- For the initial implementation, a lightweight TypeScript diff function is sufficient. If performance or quality becomes an issue, consider adopting the `diff` npm package.
- Diff output structured as an array of `{ type: 'add' | 'remove' | 'unchanged', lineNumber, content }` objects.
- Metadata diff is a separate object comparing field values between two version snapshots.

---

## 4. Notification Delivery

### Decision: In-app notifications (persistent) + Email (async, fire-and-forget)

### Rationale
- **Spec requirement**: Clarification session explicitly chose both in-app and email notifications (FR-022).
- **In-app as primary**: Persistent notifications table ensures users always see pending reviews even if email delivery fails.
- **Email as secondary**: Asynchronous dispatch ensures email failures don't block the review submission workflow.
- **No real-time WebSocket**: Polling every 30 seconds is simpler and sufficient for review notification latency. WebSocket can be added later if needed.

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **In-app + Email (dual)** | Reliable, spec-mandated, graceful degradation | Requires email service integration | **Selected (per spec)** |
| **In-app only** | Simplest implementation | Users may miss notifications when not actively using the app | Doesn't meet spec |
| **Email only** | Reaches users anywhere | No in-app presence, delivery unreliable | Doesn't meet spec |
| **WebSocket push** | Real-time, low latency | Complex infrastructure, overkill for review notifications | Deferred |

### Implementation Notes
- In-app notifications persisted to `notifications` table with user_id, type, message, is_read.
- Email dispatch via a simple `sendEmail()` utility. For initial implementation, use `nodemailer` with SMTP configuration. Can be swapped for a transactional email service (SendGrid, SES) later.
- Email sending is wrapped in try/catch with error logging; failures don't propagate to the caller.
- Frontend polls `GET /notifications/unread-count` every 30 seconds via React Query's `refetchInterval`.

---

## 5. Immutability Enforcement Strategy

### Decision: Multi-layer enforcement (Application + Database)

### Rationale
- **Defense in depth**: Relying on a single layer (e.g., only API middleware) risks bypass via direct database access, admin scripts, or future code changes.
- **Application layer**: Service methods check `branch.state` and `content.is_published` before allowing modifications.
- **Database layer**: A PostgreSQL trigger on `content_versions` prevents UPDATE and DELETE on rows whose parent content has `is_published = true`. This provides a hard safety net.

### Implementation Notes
- Application layer: `ContentService.update()` checks `branch.state === 'draft'` and `content.is_published === false` before proceeding.
- Database trigger: `BEFORE UPDATE OR DELETE ON content_versions` raises an exception if the content is published. This prevents any path (including raw SQL, admin tools, or bugs) from modifying published version history.
- The trigger is created via a Drizzle custom SQL migration.
- No API endpoint exists for deleting content versions. The only version "removal" is archival of the parent content (which does not delete data, only marks it as archived).

---

## 6. Concurrency Control

### Decision: Optimistic concurrency with version timestamp check

### Rationale
- **Low contention expected**: Content authoring is typically a single-user activity within a branch. Concurrent edits to the same content item are rare.
- **Simple implementation**: Each update request includes the `currentVersionTimestamp` the edit is based on. If it doesn't match the server's current version, the request fails with 409 Conflict.
- **No locks**: Avoids database-level row locking, which would add complexity and potential deadlocks.

### Alternatives Considered

| Strategy | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Optimistic concurrency (timestamp check)** | Simple, no locks, works for low contention | User must retry/merge on conflict | **Selected** |
| **Pessimistic locking (row locks)** | Prevents conflicts entirely | Complex, deadlock risk, bad UX (locked out) | Too heavy |
| **CRDT / operational transform** | Real-time collaboration | Extremely complex, not needed for design guidelines | Way overkill |
| **Last-write-wins** | Simplest possible | Data loss risk, violates audit requirements | Unacceptable |

### Implementation Notes
- `PUT /contents/:id` request body includes `currentVersionTimestamp: string`.
- Backend compares with `content.current_version_id → content_versions.version_timestamp`.
- On mismatch, returns `409 Conflict` with the current version in the response body so the client can show a merge/retry UI.
- Frontend shows a conflict dialog with options: "Overwrite" (uses force flag), "View diff" (compares local changes with server version), or "Cancel".
