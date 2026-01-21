# Research: Branch Isolation Model

**Branch**: `001-branch-isolation-model` | **Date**: 2026-01-21

## Overview

This document captures technology decisions and research findings for the Branch Isolation Model feature. Each section addresses a key technical decision point identified during planning.

---

## 1. Git Library Selection

### Decision: isomorphic-git

### Rationale
- **Pure JavaScript**: Runs in both Node.js and browser environments
- **No native dependencies**: Simplifies deployment and CI/CD
- **Active maintenance**: Regular updates, good community support
- **HTTP/HTTPS support**: Works with standard Git remotes
- **Lightweight**: Smaller bundle size compared to native bindings

### Alternatives Considered

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **isomorphic-git** | Pure JS, isomorphic, no native deps | Slower than native, some advanced features missing | **Selected** |
| **nodegit** | Fast (native), full Git feature parity | Native bindings, complex build, heavier | Too heavy for our needs |
| **simple-git** | Easy CLI wrapper, familiar | Requires Git CLI installed, not isomorphic | Dependency on system Git |
| **dugite** | GitHub's solution, electron-focused | Electron-centric, bundles Git binary | Not suitable for web |

### Implementation Notes
- Use `isomorphic-git` for all branch operations (create, checkout, commit, merge)
- Server-side for security-sensitive operations (convergence, history preservation)
- Consider `@isomorphic-git/lightning-fs` for in-memory file system in tests

---

## 2. State Machine Implementation

### Decision: XState v5

### Rationale
- **Type-safe**: First-class TypeScript support with generated types
- **Visual tooling**: XState Visualizer for debugging state machines
- **Actor model**: Built-in support for hierarchical and parallel states
- **Persistence**: Easy serialization/deserialization for workflow state
- **Testing**: Comprehensive testing utilities for state machines

### Alternatives Considered

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **XState v5** | Type-safe, visual tools, mature | Learning curve, bundle size | **Selected** |
| **Robot** | Lightweight, simple API | Less features, smaller ecosystem | Too limited for complex workflows |
| **Custom implementation** | Full control, no dependencies | Maintenance burden, reinventing wheel | Not justified |

### Implementation Notes
- Define branch lifecycle as XState machine with guards for transition validation
- Use XState actors for concurrent operations (multiple branches)
- Persist machine state in PostgreSQL for recovery
- Integrate XState Visualizer for development debugging

### State Machine Definition (Conceptual)
```typescript
// States: Draft, Review, Approved, Published, Archived
// Events: SUBMIT_FOR_REVIEW, APPROVE, REQUEST_CHANGES, PUBLISH, ARCHIVE
// Guards: hasCommittedChanges, isReviewer, isPublisher, validationPasses
```

---

## 3. Database Schema Design

### Decision: PostgreSQL with Drizzle ORM

### Rationale
- **ACID compliance**: Critical for atomic convergence operations
- **JSON support**: JSONB for flexible audit log metadata
- **Full-text search**: Built-in for audit log queries
- **Drizzle ORM**: Type-safe, lightweight, SQL-like syntax
- **Migration support**: Schema versioning for evolution

### Alternatives Considered

| ORM/Driver | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Drizzle** | Type-safe, lightweight, SQL-like | Newer, smaller ecosystem | **Selected** |
| **Prisma** | Great DX, visual studio | Heavy, query abstraction can be limiting | Overhead not justified |
| **Knex** | Mature, flexible | Less type safety, more boilerplate | Type safety priority |
| **TypeORM** | Full-featured, decorators | Heavy, complex, slower development | Too much overhead |

### Key Tables
- `branches`: Branch metadata, state, visibility, owner
- `branch_transitions`: State transition history
- `users`: User accounts, roles
- `audit_logs`: Comprehensive operation logging
- `convergence_operations`: Convergence tracking with status

---

## 4. Authentication Strategy

### Decision: NextAuth.js (Auth.js) with multiple providers

### Rationale
- **Multiple OAuth providers**: GitHub, Google, etc. out of the box
- **SAML/SSO support**: Enterprise identity providers via adapters
- **Session management**: Secure session handling
- **Database adapters**: Works with PostgreSQL
- **Active ecosystem**: Well-maintained, frequent updates

### Alternatives Considered

| Solution | Pros | Cons | Verdict |
|----------|------|------|---------|
| **NextAuth.js** | Multi-provider, sessions, adapters | React-centric naming | **Selected** |
| **Passport.js** | Mature, many strategies | More manual setup, Express-focused | More boilerplate |
| **Custom OAuth** | Full control | Significant implementation effort | Not justified |
| **Auth0/Clerk** | Managed, full-featured | Vendor lock-in, cost | External dependency |

### Implementation Notes
- Configure OAuth providers (GitHub, Google) for individual users
- Add SAML adapter for enterprise SSO
- API tokens for service accounts (automated processes)
- Role-based session claims for permission checks

---

## 5. API Framework Selection

### Decision: Hono with OpenAPI integration

### Rationale
- **Lightweight**: Minimal overhead, fast startup
- **Edge-ready**: Works in Node.js, Cloudflare Workers, Deno
- **TypeScript-first**: Excellent type inference
- **OpenAPI integration**: `@hono/zod-openapi` for contract-first development
- **Middleware ecosystem**: Auth, validation, logging plugins

### Alternatives Considered

| Framework | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **Hono** | Lightweight, edge-ready, modern | Newer, smaller ecosystem | **Selected** |
| **Express** | Mature, huge ecosystem | Legacy patterns, less type-safe | Older patterns |
| **Fastify** | Fast, schema validation | Heavier than Hono | More than needed |
| **tRPC** | Type-safe end-to-end | Different paradigm, less REST-like | Not REST-compatible |

### Implementation Notes
- Use `@hono/zod-openapi` for request/response validation
- Generate OpenAPI spec from route definitions
- Middleware stack: auth, permissions, audit logging
- Structured error responses with problem details

---

## 6. Frontend State Management

### Decision: TanStack Query + Zustand

### Rationale
- **TanStack Query**: Server state management, caching, background refetching
- **Zustand**: Client state (UI, forms) with minimal boilerplate
- **Separation of concerns**: Server state vs. client state clearly separated
- **React 19 compatible**: Works with latest React features

### Alternatives Considered

| Solution | Pros | Cons | Verdict |
|----------|------|------|---------|
| **TanStack Query + Zustand** | Separation of concerns, lightweight | Two libraries | **Selected** |
| **Redux Toolkit** | Full-featured, RTK Query | Heavy for this use case | Overkill |
| **Jotai** | Atomic, minimal | Less structured for complex state | Less conventions |
| **React Context only** | Built-in, no deps | Performance issues at scale | Not sufficient |

### Implementation Notes
- TanStack Query for all API calls (branches, reviews, audit logs)
- Zustand for UI state (selected branch, form state, modal visibility)
- Optimistic updates for better UX during state transitions
- Cache invalidation on successful mutations

---

## 7. Diff/Comparison Library

### Decision: diff-match-patch + Monaco Editor

### Rationale
- **diff-match-patch**: Google's battle-tested diff algorithm
- **Monaco Editor**: VS Code's editor with built-in diff view
- **Rich UI**: Side-by-side and inline diff visualization
- **Performance**: Efficient for large documents

### Alternatives Considered

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **diff-match-patch + Monaco** | Rich UI, performant, proven | Bundle size | **Selected** |
| **jsdiff** | Lightweight | Basic output, no UI | UI needed |
| **react-diff-viewer** | React component | Less customizable | Limited features |

### Implementation Notes
- Server-side diff computation with `diff-match-patch`
- Monaco DiffEditor for visual comparison in UI
- Support both side-by-side and unified diff views
- Highlight additions (green), deletions (red), modifications (yellow)

---

## 8. Testing Strategy

### Decision: Vitest + Playwright + Pact

### Rationale
- **Vitest**: Fast, Vite-native, Jest-compatible API
- **Playwright**: Cross-browser E2E, reliable
- **Pact**: Consumer-driven contract testing for API
- **Unified stack**: All tools work well with TypeScript/Vite

### Alternatives Considered

| Category | Selected | Alternative | Why Selected |
|----------|----------|-------------|--------------|
| Unit/Integration | **Vitest** | Jest | Vite-native, faster |
| E2E | **Playwright** | Cypress | Better cross-browser, faster |
| Contract | **Pact** | OpenAPI validation | Consumer-driven, more rigorous |

### Test Coverage Targets
- Unit tests: 80% for core services (state machine, Git operations, permissions)
- Integration tests: 100% of API endpoints
- E2E tests: All 6 user stories with acceptance scenarios
- Contract tests: All API contracts validated

---

## 9. Audit Log Architecture

### Decision: PostgreSQL JSONB with async write

### Rationale
- **JSONB flexibility**: Variable metadata per event type
- **Async writes**: Non-blocking audit logging via queue
- **Retention**: PostgreSQL partitioning for 7-year retention
- **Query performance**: GIN indexes on JSONB fields

### Implementation Notes
- Audit events written to in-memory queue first
- Background worker persists to PostgreSQL
- Table partitioned by month for performance
- GIN indexes on `metadata` JSONB for queries
- Archive old partitions to cold storage after 1 year

### Audit Event Schema
```typescript
interface AuditEvent {
  id: string;
  timestamp: string; // ISO 8601
  actor: string; // user:123 or system:validator
  action: string; // branch_created, state_transitioned, etc.
  resource: string; // branch:456
  metadata: Record<string, unknown>; // Event-specific data
}
```

---

## 10. Deployment & Preview System

### Decision: Vercel/Cloudflare for previews + GitHub Actions for CI

### Rationale
- **Vercel/Cloudflare**: Automatic preview deployments per branch
- **GitHub Actions**: CI/CD pipeline, runs tests, deploys
- **Preview URLs**: Unique URL per branch for staging validation
- **Environment isolation**: Separate dev/stage/main environments

### Implementation Notes
- Each feature branch gets preview URL via Vercel/Cloudflare
- Stage environment for integration testing
- Main branch deploys to production
- GitHub Actions runs full test suite before merge

---

## Summary of Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Git Operations** | isomorphic-git | Branch creation, commits, merges |
| **State Machine** | XState v5 | Lifecycle state management |
| **Database** | PostgreSQL + Drizzle | Metadata, audit logs, workflow state |
| **Authentication** | NextAuth.js | OAuth, SAML, session management |
| **API** | Hono | REST endpoints with OpenAPI |
| **Frontend State** | TanStack Query + Zustand | Server and client state |
| **Diff/Comparison** | diff-match-patch + Monaco | Change visualization |
| **Testing** | Vitest + Playwright + Pact | Unit, E2E, contract tests |
| **Deployment** | Vercel/Cloudflare + GitHub Actions | Preview, CI/CD |

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Git library for browser+server? | isomorphic-git - pure JS, works both |
| State machine library? | XState v5 - type-safe, visual tools |
| ORM for PostgreSQL? | Drizzle - lightweight, type-safe |
| Auth solution? | NextAuth.js - multi-provider, SAML support |
| API framework? | Hono - lightweight, OpenAPI integration |
| Frontend state? | TanStack Query + Zustand - separation of concerns |
| Diff visualization? | Monaco DiffEditor - rich, performant |
| Testing stack? | Vitest + Playwright + Pact - comprehensive |
| Audit log storage? | PostgreSQL JSONB with async writes |
| Preview deployments? | Vercel/Cloudflare with branch previews |
