# echo-portal Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-21

## Active Technologies
- TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 (frontend), Drizzle ORM 0.44.0, arctic 3.5.0 (OAuth), xstate 5.19.2 (state machines), zod 3.24.2 (002-identity-roles-permissions)
- PostgreSQL (existing Drizzle schema with users, branches, reviews, audit-logs tables) (002-identity-roles-permissions)
- TypeScript 5.9.3, Node.js 20 LTS + React 19.2.0, @radix-ui/themes (to install), Vite 7.2.4, @tailwindcss/vite 4.1.18 (004-radix-themes-migration)
- localStorage (theme preference), PostgreSQL (existing, unchanged) (004-radix-themes-migration)
- TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 (frontend), Drizzle ORM 0.44.0, XState 5.19.2, Zod 3.24.2 (006-review-approval)
- PostgreSQL (existing Drizzle schema) + new `review_snapshots` table (006-review-approval)
- TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 + Zustand + TanStack Query 5 (frontend), Milkdown (editor), Drizzle ORM 0.44 (PostgreSQL), XState 5.19.2, Zod 3.24.2 (007-ai-assisted-authoring)
- PostgreSQL (existing schema + new `ai_requests`, `ai_conversations`, `ai_configurations` tables) (007-ai-assisted-authoring)
- TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 + Zustand + TanStack Query 5 (frontend), Milkdown (editor), Drizzle ORM 0.44 (PostgreSQL), Zod 3.24.2 (008-image-compliance-analysis)
- PostgreSQL (existing `ai_configurations` table — no new tables) (008-image-compliance-analysis)
- TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 + Zustand + TanStack Query 5 (frontend), Drizzle ORM 0.44 (PostgreSQL), Zod 3.24.2, @radix-ui/themes + @radix-ui/react-popover (009-notification-alerts)
- PostgreSQL (existing `notifications` table + new `notification_preferences` table) (009-notification-alerts)
- TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 + Radix UI (frontend), Drizzle ORM 0.44 (PostgreSQL), arctic 3.5.0 (existing OAuth), argon2 (new — password hashing), nodemailer (new — email delivery), Zod 3.24.2 (validation) (010-email-password-auth)
- PostgreSQL (existing Drizzle schema — modified `users` table + new `auth_tokens` table) (010-email-password-auth)
- TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 + Radix UI + Zustand + TanStack Query 5 (frontend), Drizzle ORM 0.44, @dnd-kit/core + @dnd-kit/sortable (new) (011-sidebar-content-hierarchy)
- PostgreSQL (existing Drizzle schema — new `subcategories` table, modified `contents` table) (011-sidebar-content-hierarchy)

- TypeScript 5.9+, Node.js 20 LTS + React 19, Vite 7, isomorphic-git (client-side Git), PostgreSQL (metadata) (001-branch-isolation-model)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.9+, Node.js 20 LTS: Follow standard conventions

## Recent Changes
- 011-sidebar-content-hierarchy: Added TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 + Radix UI + Zustand + TanStack Query 5 (frontend), Drizzle ORM 0.44, @dnd-kit/core + @dnd-kit/sortable (new)
- 010-email-password-auth: Added TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 + Radix UI (frontend), Drizzle ORM 0.44 (PostgreSQL), arctic 3.5.0 (existing OAuth), argon2 (new — password hashing), nodemailer (new — email delivery), Zod 3.24.2 (validation)
- 009-notification-alerts: Added TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 + Zustand + TanStack Query 5 (frontend), Drizzle ORM 0.44 (PostgreSQL), Zod 3.24.2, @radix-ui/themes + @radix-ui/react-popover


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
