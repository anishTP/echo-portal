# Quickstart: Email/Password Authentication

**Feature Branch**: `010-email-password-auth`

## Prerequisites

- Node.js 20 LTS
- PostgreSQL running with `echo_portal` database
- pnpm installed
- Backend running on port 3001, frontend on port 5173

## Setup

### 1. Install new dependencies

```bash
cd backend && pnpm add argon2 nodemailer && pnpm add -D @types/nodemailer
```

### 2. Run database migration

```bash
cd backend && pnpm drizzle-kit generate && pnpm drizzle-kit migrate
```

This migration:
- Adds `'email'` to `auth_provider` enum
- Adds `password_hash` (nullable), `email_verified` (boolean) columns to users
- Makes `external_id` nullable
- Creates `auth_tokens` table
- Sets `email_verified = true` for all existing OAuth users

### 3. Configure environment variables

Add to `backend/.env`:

```bash
# Email (optional in development — falls back to console logging)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@echo-portal.com
```

When SMTP is not configured, all emails are logged to the console with the full action URL — making development easy without an email provider.

### 4. Start the servers

```bash
# Terminal 1
cd backend && pnpm dev

# Terminal 2
cd frontend && pnpm dev
```

## Testing the Flow

### Signup
1. Navigate to `http://localhost:5173/signup`
2. Enter email, display name, password
3. Password strength indicator shows criteria met
4. Submit — see "Check your email" message
5. In dev mode: check backend console for verification URL
6. Click the URL (or paste into browser)
7. See "Email verified" confirmation

### Login
1. Navigate to `http://localhost:5173/login`
2. Enter email and password
3. Redirected to dashboard on success

### Password Reset
1. From login page, click "Forgot password?"
2. Enter email, submit
3. Check console (dev) for reset URL
4. Click URL, enter new password
5. Log in with new password

### OAuth (unchanged)
1. From login page, click "Continue with GitHub" or "Continue with Google"
2. Same flow as before — OAuth buttons are now on the login page instead of the header

## Key Files

### Backend (new)
- `backend/src/db/schema/auth-tokens.ts` — Auth tokens table
- `backend/src/services/email/` — Email service (interface, SMTP, console)
- `backend/src/services/auth/password.ts` — Password hashing and validation
- `backend/src/services/auth/token.ts` — Token generation and validation
- `backend/src/api/middleware/auth-rate-limit.ts` — Rate limiting for auth endpoints

### Backend (modified)
- `backend/src/db/schema/enums.ts` — Add 'email' to auth_provider enum
- `backend/src/db/schema/users.ts` — Add passwordHash, emailVerified columns
- `backend/src/db/schema/index.ts` — Export auth-tokens
- `backend/src/api/routes/auth.ts` — New email auth endpoints + modify findOrCreateUser
- `backend/src/api/routes/auth.ts` — Scheduled cleanup (unverified accounts + expired tokens)

### Frontend (new)
- `frontend/src/pages/LoginPage.tsx` — Unified login (OAuth + email form)
- `frontend/src/pages/SignupPage.tsx` — Email registration form
- `frontend/src/pages/VerifyEmailPage.tsx` — Verification handler
- `frontend/src/pages/ForgotPasswordPage.tsx` — Request reset
- `frontend/src/pages/ResetPasswordPage.tsx` — Set new password
- `frontend/src/components/auth/PasswordStrength.tsx` — Strength indicator

### Frontend (modified)
- `frontend/src/router/index.tsx` — Add new routes
- `frontend/src/components/layout/AppHeader.tsx` — Replace OAuth buttons with "Sign In" link
- `frontend/src/context/AuthContext.tsx` — Add email auth methods

### Shared (modified)
- `shared/constants/states.ts` — Add EMAIL to AuthProvider
- `shared/types/auth.ts` — Extend provider types

## Verification Checklist

- [ ] Signup creates user with `provider='email'`, `emailVerified=false`
- [ ] Verification email token works within 24h
- [ ] Login rejects unverified users with helpful message
- [ ] Login creates identical session to OAuth
- [ ] Failed login integrates with existing lockout (5 attempts → 15 min)
- [ ] Password reset invalidates all sessions
- [ ] Rate limits enforce on signup, resend, reset
- [ ] OAuth flow still works (regression)
- [ ] Email with existing OAuth provider is rejected at signup
- [ ] OAuth with existing email provider is rejected at callback
- [ ] Unverified accounts purged after 7 days
- [ ] Console logging works in dev when SMTP not configured
- [ ] Password strength indicator matches server validation
