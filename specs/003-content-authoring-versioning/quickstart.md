# Quickstart: Content Authoring and Versioning

**Branch**: `003-content-authoring-versioning` | **Date**: 2026-01-27

## Prerequisites

- Node.js 20 LTS or later
- PostgreSQL 15+ (local or Docker)
- pnpm (workspace monorepo)
- Existing echo-portal setup with Features 001 and 002 applied

## Quick Setup

### 1. Switch to Feature Branch

```bash
git checkout 003-content-authoring-versioning
pnpm install
```

### 2. Apply Database Migration

```bash
cd backend

# Generate migration from schema changes
pnpm db:generate

# Apply migration to database
pnpm db:push
```

This creates the following new tables:
- `contents` - Content items within branches
- `content_versions` - Immutable version history
- `content_references` - Cross-content reference tracking
- `notifications` - In-app notification storage

### 3. Verify Migration

```bash
# Start the backend
pnpm dev

# In another terminal, verify the tables exist
curl http://localhost:3001/health
```

### 4. Start Development

```bash
# From repository root
pnpm dev

# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

## Core Workflows

### Create Content in a Branch

```bash
# 1. Authenticate (get session cookie)
# Use the OAuth flow or dev auth

# 2. Create a branch (if not exists)
curl -X POST http://localhost:3001/api/v1/branches \
  -H "Content-Type: application/json" \
  -b "echo_session=<your-token>" \
  -d '{
    "name": "Typography Guidelines",
    "description": "New typography standards for VIDA"
  }'

# 3. Create content within the branch
curl -X POST http://localhost:3001/api/v1/contents \
  -H "Content-Type: application/json" \
  -b "echo_session=<your-token>" \
  -d '{
    "branchId": "<branch-id>",
    "title": "Typography Scale",
    "contentType": "guideline",
    "category": "Typography",
    "tags": ["typography", "scale", "sizing"],
    "body": "# Typography Scale\n\nOur type scale uses a 1.25 ratio...",
    "bodyFormat": "markdown",
    "changeDescription": "Initial typography scale guidelines"
  }'
```

### Update Content (Creates New Version)

```bash
curl -X PUT http://localhost:3001/api/v1/contents/<content-id> \
  -H "Content-Type: application/json" \
  -b "echo_session=<your-token>" \
  -d '{
    "body": "# Typography Scale\n\nUpdated: Our type scale uses a 1.333 ratio...",
    "changeDescription": "Updated ratio from 1.25 to 1.333 based on review feedback",
    "currentVersionTimestamp": "2026-01-27T14:30:00.000Z"
  }'
```

### View Version History

```bash
curl http://localhost:3001/api/v1/contents/<content-id>/versions \
  -b "echo_session=<your-token>"

# Response: Array of versions ordered by timestamp DESC
# Each version includes: versionTimestamp, author, changeDescription, byteSize
```

### Compare Two Versions

```bash
curl "http://localhost:3001/api/v1/contents/<content-id>/diff?from=2026-01-27T14:30:00.000Z&to=2026-01-27T15:45:00.000Z" \
  -b "echo_session=<your-token>"

# Response: Structured diff with additions, deletions, modifications
```

### Revert to Previous Version

```bash
curl -X POST http://localhost:3001/api/v1/contents/<content-id>/revert \
  -H "Content-Type: application/json" \
  -b "echo_session=<your-token>" \
  -d '{
    "targetVersionTimestamp": "2026-01-27T14:30:00.000Z",
    "changeDescription": "Reverting to original 1.25 ratio"
  }'
```

### View Content Lineage

```bash
curl http://localhost:3001/api/v1/contents/<content-id>/lineage \
  -b "echo_session=<your-token>"

# Response: Full chain from current version back through all parent versions,
# including source content if this updates previously published content
```

## Key Concepts

### Branch Binding
All content must exist within a branch. Attempting to create content without a `branchId` returns `400 Bad Request`. This ensures every contribution participates in the governed lifecycle.

### Immutable Versions
Every save creates a new version. Previous versions are never modified or deleted. The version's ISO 8601 timestamp serves as its unique identifier within the content item.

### Published Content Immutability
Once content is published (branch transitions to `published` state), all content and versions within that branch become read-only. To make changes, create a new branch linked via `sourceContentId`.

### Size Limits
Content body is limited to 50 MB per item. The backend enforces this at the API layer and returns `413 Content Too Large` for oversized requests.

### AI Attribution
AI-assisted content uses the same API endpoints. Set `authorType: 'system'` in the request and include AI model details in `changeDescription`. The AI service account must authenticate via API token.

## Testing

```bash
# Run all tests
cd backend && pnpm test

# Run content-specific tests
pnpm test -- --grep "content"

# Run with coverage
pnpm test:coverage
```

## Troubleshooting

### "Branch not found" on content creation
Ensure the `branchId` references an existing branch. Use `GET /api/v1/branches/me` to list your branches.

### "Content modification not allowed" on update
Content can only be modified when the parent branch is in `draft` state. If the branch is in `review`, `approved`, or `published` state, modifications are blocked.

### "Version conflict" (409) on update
Another user (or the same user in another tab) modified the content since you loaded it. Refresh and retry, or use the diff endpoint to compare your changes with the latest version.

### "Content Too Large" (413) on save
Content body exceeds the 50 MB limit. Consider splitting large content into smaller items, or using external references for large binary assets.
