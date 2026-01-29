# echo-portal Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-21

## Active Technologies
- TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 (frontend), Drizzle ORM 0.44.0, arctic 3.5.0 (OAuth), xstate 5.19.2 (state machines), zod 3.24.2 (002-identity-roles-permissions)
- PostgreSQL (existing Drizzle schema with users, branches, reviews, audit-logs tables) (002-identity-roles-permissions)
- TypeScript 5.9.3, Node.js 20 LTS + React 19.2.0, @radix-ui/themes (to install), Vite 7.2.4, @tailwindcss/vite 4.1.18 (004-radix-themes-migration)
- localStorage (theme preference), PostgreSQL (existing, unchanged) (004-radix-themes-migration)

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
- 004-radix-themes-migration: Added TypeScript 5.9.3, Node.js 20 LTS + React 19.2.0, @radix-ui/themes (to install), Vite 7.2.4, @tailwindcss/vite 4.1.18
- 002-identity-roles-permissions: Added TypeScript 5.9+, Node.js 20 LTS + Hono 4.8.2 (backend), React 19 (frontend), Drizzle ORM 0.44.0, arctic 3.5.0 (OAuth), xstate 5.19.2 (state machines), zod 3.24.2

- 001-branch-isolation-model: Added TypeScript 5.9+, Node.js 20 LTS + React 19, Vite 7, isomorphic-git (client-side Git), PostgreSQL (metadata)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
