# Echo Portal API Documentation

**Version**: 1.0.0
**Base URL**: `/api/v1`

## Authentication

All authenticated endpoints require a valid session cookie obtained through OAuth login.

### Development Login

For local development, use the dev login endpoint:

```bash
POST /api/v1/auth/dev-login
Content-Type: application/json

{
  "email": "dev@example.com",
  "roles": ["contributor", "reviewer"]
}
```

### Production OAuth

- **GitHub**: `GET /api/v1/auth/github`
- **Google**: `GET /api/v1/auth/google`

---

## Branches

### Create Branch

```http
POST /api/v1/branches
```

**Request Body**:
```json
{
  "name": "My Feature Branch",
  "baseRef": "main",
  "description": "Optional description",
  "visibility": "private",
  "labels": ["feature", "ui"]
}
```

**Response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Feature Branch",
    "slug": "my-feature-branch",
    "gitRef": "branches/my-feature-branch",
    "baseRef": "main",
    "baseCommit": "abc123",
    "headCommit": "abc123",
    "state": "draft",
    "visibility": "private",
    "ownerId": "user-uuid",
    "reviewers": [],
    "labels": ["feature", "ui"],
    "createdAt": "2026-01-23T00:00:00Z",
    "updatedAt": "2026-01-23T00:00:00Z",
    "permissions": {
      "canEdit": true,
      "canSubmitForReview": true,
      "canApprove": false,
      "canPublish": false,
      "canArchive": true,
      "validTransitions": ["SUBMIT_FOR_REVIEW", "ARCHIVE"]
    }
  }
}
```

### List Branches

```http
GET /api/v1/branches
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `ownerId` | uuid | Filter by owner |
| `state` | string | Comma-separated states: draft,review,approved,published,archived |
| `visibility` | string | Comma-separated: private,team,public |
| `search` | string | Search in name and description |

### Get Branch

```http
GET /api/v1/branches/:id
```

### Update Branch

```http
PATCH /api/v1/branches/:id
```

**Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "visibility": "team",
  "labels": ["updated"]
}
```

### Delete Branch

```http
DELETE /api/v1/branches/:id
```

Only draft branches can be deleted. Returns `204 No Content`.

### Get Branch Diff

```http
GET /api/v1/branches/:id/diff
```

**Response**:
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "path": "src/file.ts",
        "status": "modified",
        "additions": 10,
        "deletions": 5,
        "hunks": [
          {
            "oldStart": 1,
            "oldLines": 10,
            "newStart": 1,
            "newLines": 15,
            "lines": [
              { "type": "context", "content": "unchanged line" },
              { "type": "deletion", "content": "removed line" },
              { "type": "addition", "content": "added line" }
            ]
          }
        ]
      }
    ],
    "summary": {
      "totalFiles": 1,
      "additions": 10,
      "deletions": 5
    }
  }
}
```

### Get Diff Summary

```http
GET /api/v1/branches/:id/diff/summary
```

Returns file list without detailed hunks.

---

## Reviewers

### Get Branch Reviewers

```http
GET /api/v1/branches/:id/reviewers
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "email": "reviewer@example.com",
      "displayName": "Jane Reviewer",
      "avatarUrl": "https://...",
      "roles": ["reviewer"]
    }
  ]
}
```

### Search Potential Reviewers

```http
GET /api/v1/branches/:id/reviewers/search?q=jane&limit=10
```

### Add Reviewers

```http
POST /api/v1/branches/:id/reviewers
```

**Request Body**:
```json
{
  "reviewerIds": ["user-uuid-1", "user-uuid-2"]
}
```

### Remove Reviewer

```http
DELETE /api/v1/branches/:id/reviewers/:reviewerId
```

---

## State Transitions

### Trigger Transition

```http
POST /api/v1/branches/:id/transitions
```

**Request Body**:
```json
{
  "event": "SUBMIT_FOR_REVIEW",
  "reason": "Ready for review",
  "metadata": {}
}
```

**Valid Events**:
| Event | From State | To State | Required Role |
|-------|-----------|----------|---------------|
| `SUBMIT_FOR_REVIEW` | draft | review | owner |
| `REQUEST_CHANGES` | review | draft | reviewer |
| `APPROVE` | review | approved | reviewer |
| `PUBLISH` | approved | published | publisher |
| `ARCHIVE` | any | archived | owner/admin |

### Get Transition History

```http
GET /api/v1/branches/:id/transitions
```

### Check Transition Validity

```http
GET /api/v1/branches/:id/can-transition?event=SUBMIT_FOR_REVIEW
```

---

## Reviews

### Request Review

```http
POST /api/v1/reviews
```

**Request Body**:
```json
{
  "branchId": "branch-uuid",
  "reviewerIds": ["reviewer-uuid"],
  "message": "Please review these changes"
}
```

### List Reviews

```http
GET /api/v1/reviews
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `branchId` | uuid | Filter by branch |
| `reviewerId` | uuid | Filter by reviewer |
| `status` | string | pending,in_progress,completed,cancelled |

### Approve Review

```http
POST /api/v1/reviews/:id/approve
```

**Request Body**:
```json
{
  "comment": "Looks good!"
}
```

### Request Changes

```http
POST /api/v1/reviews/:id/request-changes
```

**Request Body**:
```json
{
  "comment": "Please fix the following..."
}
```

### Add Comment

```http
POST /api/v1/reviews/:id/comments
```

**Request Body**:
```json
{
  "content": "Comment text",
  "filePath": "src/file.ts",
  "lineNumber": 42
}
```

---

## Convergence (Publishing)

### Validate Convergence

```http
POST /api/v1/convergence/validate
```

**Request Body**:
```json
{
  "branchId": "branch-uuid",
  "targetBranch": "main"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "canConverge": true,
    "conflicts": [],
    "warnings": []
  }
}
```

### Initiate Convergence

```http
POST /api/v1/convergence
```

**Request Body**:
```json
{
  "branchId": "branch-uuid",
  "targetBranch": "main",
  "message": "Publishing feature X"
}
```

### Get Convergence Status

```http
GET /api/v1/convergence/:id/status
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "convergence-uuid",
    "status": "succeeded",
    "branchId": "branch-uuid",
    "targetBranch": "main",
    "mergeCommit": "def456",
    "mergedAt": "2026-01-23T00:00:00Z"
  }
}
```

---

## Audit

### Query Audit Logs

```http
GET /api/v1/audit
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `resourceType` | string | branch,review,convergence,user |
| `resourceId` | uuid | Filter by resource |
| `actorId` | uuid | Filter by actor |
| `actions` | string | Comma-separated action types |
| `startDate` | ISO 8601 | Filter after date |
| `endDate` | ISO 8601 | Filter before date |
| `page` | number | Page number |
| `limit` | number | Items per page (max: 100) |

**Requires**: Administrator or Reviewer role

### Get Audit Stats

```http
GET /api/v1/audit/stats
```

**Requires**: Administrator role

### Get My Activity

```http
GET /api/v1/audit/my-activity?limit=50
```

### Get Branch History

```http
GET /api/v1/audit/branches/:id/history?limit=100&includeRelated=true
```

### Get Branch Lineage

```http
GET /api/v1/audit/branches/:id/lineage
```

**Response**:
```json
{
  "success": true,
  "data": {
    "branch": {
      "id": "uuid",
      "name": "Feature Branch",
      "state": "published",
      "owner": { "id": "uuid", "displayName": "John" }
    },
    "baseRef": "main",
    "baseCommit": "abc123",
    "headCommit": "def456",
    "events": [
      {
        "id": "event-uuid",
        "action": "state_transition",
        "fromState": "draft",
        "toState": "review",
        "timestamp": "2026-01-23T00:00:00Z",
        "actor": { "id": "uuid", "displayName": "John" }
      }
    ],
    "convergence": {
      "id": "uuid",
      "status": "succeeded",
      "mergedAt": "2026-01-23T00:00:00Z",
      "mergeCommit": "ghi789"
    },
    "relatedBranches": []
  }
}
```

### Get Branch Timeline

```http
GET /api/v1/audit/branches/:id/timeline
```

### Get Branch Tree

```http
GET /api/v1/audit/branch-tree?baseRef=main&limit=50
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Branch not found",
    "details": {}
  }
}
```

**Common Error Codes**:
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | State conflict (e.g., invalid transition) |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

- **Default**: 100 requests per minute
- **Authenticated**: 1000 requests per minute
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
