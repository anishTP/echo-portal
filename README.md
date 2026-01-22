# Echo Portal

A branch isolation model for governed contribution workflows. Enables contributors to create isolated branches, submit for review, and publish approved changes to main.

## Features

- **Branch Isolation**: Create isolated workspaces that don't affect published content
- **Review Workflow**: Submit branches for review, approve or request changes
- **Atomic Publishing**: Merge approved branches with conflict detection and rollback support
- **Role-Based Access**: Contributors, reviewers, publishers, and administrators

## Tech Stack

- **Frontend**: React 19, Vite 7, TanStack Query, Zustand
- **Backend**: Hono, Drizzle ORM, XState v5
- **Database**: PostgreSQL 16
- **Auth**: OAuth (GitHub, Google)

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd echo-portal
pnpm install
```

### 2. Start the Database

```bash
# Start PostgreSQL with Docker
docker-compose up -d

# If you have docker-compose v1 (with hyphen)
docker-compose up -d

# Verify it's running
docker ps
```

> **Note**: If you have a local PostgreSQL running on port 5432, stop it first:
> ```bash
> brew services stop postgresql
> ```

### 3. Configure Environment

```bash
cp backend/.env.example backend/.env
```

The defaults work for local development. OAuth credentials are optional.

### 4. Build Shared Types

```bash
pnpm --filter @echo-portal/shared build
```

### 5. Push Database Schema

```bash
pnpm db:push
```

Select "Yes, I want to execute all statements" when prompted.

### 6. Start Development Servers

```bash
pnpm dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm dev:frontend` | Start frontend only |
| `pnpm dev:backend` | Start backend only |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm lint` | Run linting |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Drizzle Studio |

## Project Structure

```
echo-portal/
├── backend/           # Hono API server
│   ├── src/
│   │   ├── api/       # Routes, middleware, schemas
│   │   ├── db/        # Drizzle schema
│   │   ├── models/    # Domain models
│   │   └── services/  # Business logic
│   └── drizzle/       # Migrations
├── frontend/          # React application
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── stores/
└── shared/            # Shared types and constants
```

## API Endpoints

### Branches
- `POST /api/v1/branches` - Create branch
- `GET /api/v1/branches` - List branches
- `GET /api/v1/branches/:id` - Get branch
- `PATCH /api/v1/branches/:id` - Update branch
- `POST /api/v1/branches/:id/transitions` - State transition

### Reviews
- `POST /api/v1/reviews` - Request review
- `GET /api/v1/reviews` - List reviews
- `POST /api/v1/reviews/:id/approve` - Approve
- `POST /api/v1/reviews/:id/request-changes` - Request changes

### Convergence (Publishing)
- `POST /api/v1/convergence` - Initiate publish
- `POST /api/v1/convergence/validate` - Pre-publish validation
- `POST /api/v1/convergence/:id/execute` - Execute publish

## Troubleshooting

### Port 5432 already in use
```bash
# Check what's using the port
lsof -i :5432

# Stop local PostgreSQL
brew services stop postgresql

# Restart Docker
docker-compose down && docker-compose up -d
```

### Database connection issues
```bash
# Test Docker PostgreSQL directly
docker exec -it echo-portal-db psql -U postgres -d echo_portal -c "SELECT 1"
```

### Module not found errors
```bash
# Rebuild shared types
pnpm --filter @echo-portal/shared build
```

## License

MIT
