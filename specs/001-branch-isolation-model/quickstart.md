# Quickstart: Branch Isolation Model

**Branch**: `001-branch-isolation-model` | **Date**: 2026-01-21

## Prerequisites

- Node.js 20 LTS or later
- PostgreSQL 15+ (local or Docker)
- Git 2.40+
- pnpm (recommended) or npm

## Quick Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone git@github.com:your-org/echo-portal.git
cd echo-portal

# Install dependencies
pnpm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your local settings
# Required variables:
# - DATABASE_URL=postgresql://user:password@localhost:5432/echo_portal
# - NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
# - GITHUB_CLIENT_ID=<your-github-oauth-app-id>
# - GITHUB_CLIENT_SECRET=<your-github-oauth-app-secret>
```

### 3. Database Setup

```bash
# Start PostgreSQL (if using Docker)
docker compose up -d postgres

# Run migrations
pnpm db:migrate

# Seed initial data (dev only)
pnpm db:seed
```

### 4. Start Development

```bash
# Start all services (backend + frontend)
pnpm dev

# Or start individually:
pnpm --filter backend dev
pnpm --filter frontend dev
```

### 5. Verify Setup

Open http://localhost:5173 in your browser. You should see the Echo Portal dashboard.

---

## Project Structure

```
echo-portal/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── models/         # Database models (Drizzle)
│   │   ├── services/       # Business logic
│   │   │   ├── git/        # Git operations
│   │   │   ├── workflow/   # State machine
│   │   │   ├── auth/       # Authentication
│   │   │   └── audit/      # Audit logging
│   │   └── api/            # HTTP routes (Hono)
│   └── tests/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API client
│   │   └── hooks/          # React hooks
│   └── tests/
├── shared/                 # Shared types and constants
└── specs/                  # Feature specifications
```

---

## Development Workflow

### Creating a Branch

```typescript
// POST /api/v1/branches
const response = await fetch('/api/v1/branches', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Update homepage hero section',
    baseRef: 'main',  // or 'dev' for design team
    visibility: 'private'
  })
});

const branch = await response.json();
// { id: 'uuid', name: '...', state: 'draft', gitRef: 'feature/user/update-homepage-hero-section' }
```

### Branch State Transitions

```typescript
// Submit for review
await fetch(`/api/v1/branches/${branchId}/transitions`, {
  method: 'POST',
  body: JSON.stringify({ event: 'SUBMIT_FOR_REVIEW' })
});

// Approve (reviewer)
await fetch(`/api/v1/reviews/${reviewId}/approve`, {
  method: 'POST'
});

// Publish (publisher)
await fetch('/api/v1/convergence', {
  method: 'POST',
  body: JSON.stringify({ branchId })
});
```

---

## Testing

### Run All Tests

```bash
# Unit and integration tests
pnpm test

# E2E tests
pnpm test:e2e

# Contract tests
pnpm test:contract
```

### Run Specific Tests

```bash
# Backend unit tests
pnpm --filter backend test:unit

# Frontend component tests
pnpm --filter frontend test

# State machine tests
pnpm --filter backend test -- --grep "state machine"
```

### Test Coverage

```bash
pnpm test:coverage
# Coverage reports generated in coverage/
```

---

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development servers |
| `pnpm build` | Build for production |
| `pnpm test` | Run all tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed development data |
| `pnpm db:studio` | Open Drizzle Studio |

---

## API Endpoints Reference

### Branches
- `GET /api/v1/branches` - List branches
- `POST /api/v1/branches` - Create branch
- `GET /api/v1/branches/:id` - Get branch details
- `PATCH /api/v1/branches/:id` - Update branch
- `POST /api/v1/branches/:id/transitions` - State transition
- `GET /api/v1/branches/:id/diff` - Get diff

### Reviews
- `GET /api/v1/reviews` - List reviews
- `POST /api/v1/reviews` - Request review
- `POST /api/v1/reviews/:id/approve` - Approve
- `POST /api/v1/reviews/:id/request-changes` - Request changes

### Convergence
- `POST /api/v1/convergence` - Initiate merge
- `GET /api/v1/convergence/:id/status` - Check status
- `POST /api/v1/convergence/validate` - Dry run validation

### Audit
- `GET /api/v1/audit` - Query audit logs
- `GET /api/v1/branches/:id/history` - Branch history

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_SECRET` | Session encryption key | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID | For GitHub auth |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | For GitHub auth |
| `GOOGLE_CLIENT_ID` | Google OAuth app ID | For Google auth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | For Google auth |
| `GIT_REPO_PATH` | Path to Git repository | Yes |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | No |

---

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose ps

# View logs
docker compose logs postgres

# Reset database (WARNING: destroys data)
pnpm db:reset
```

### Git Operation Failures

```bash
# Check Git repository is initialized
cd $GIT_REPO_PATH && git status

# Ensure correct permissions
ls -la $GIT_REPO_PATH
```

### Authentication Issues

1. Verify OAuth callback URL matches `NEXTAUTH_URL`
2. Check OAuth app credentials are correct
3. Clear browser cookies and retry

---

## Next Steps

1. Review the [spec.md](./spec.md) for detailed requirements
2. Review the [data-model.md](./data-model.md) for entity schemas
3. Review the [research.md](./research.md) for technology decisions
4. Check the API contracts in [contracts/](./contracts/) for endpoint details
5. Run the test suite to verify setup: `pnpm test`

---

## Getting Help

- Check existing documentation in `/specs`
- Review code comments and JSDoc
- Run tests with verbose output: `pnpm test -- --verbose`
- Check GitHub issues for known problems
