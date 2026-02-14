# API Contracts: Email/Password Authentication

**Base Path**: `/api/v1/auth`
**Date**: 2026-02-13

All new endpoints extend the existing auth route group in `backend/src/api/routes/auth.ts`.

---

## POST /auth/register

Create a new email/password account.

**Auth**: None (public)
**Rate Limit**: 5 per hour per IP (FR-013)

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "MyP@ssw0rd",
  "displayName": "Jane Doe"
}
```

**Validation (Zod)**:
- `email`: `z.string().email().max(255)`
- `password`: `z.string().min(8).max(128)` + custom 3-of-4-types validator
- `displayName`: `z.string().trim().min(1).max(100)`

**Success Response** `201`:
```json
{
  "success": true,
  "data": {
    "message": "Account created. Please check your email to verify your account."
  }
}
```

**Error Responses**:
- `400` — Validation failed (password too weak, invalid email format)
- `409` — Email already in use: `"An account with this email already exists"`
- `429` — Rate limit exceeded

**Side Effects**:
- Creates user with `provider='email'`, `emailVerified=false`, `roles=['contributor']`
- Generates verification token (24h expiry)
- Sends verification email (or logs to console in dev)
- Audit event: `auth.register`

---

## POST /auth/login

Authenticate with email and password.

**Auth**: None (public)
**Rate Limit**: Uses existing login attempt tracking (5 failures → 15-min lockout per FR-006)

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "MyP@ssw0rd"
}
```

**Validation (Zod)**:
- `email`: `z.string().email()`
- `password`: `z.string().min(1)`

**Success Response** `200`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "displayName": "Jane Doe",
      "avatarUrl": null,
      "roles": ["contributor"],
      "role": "contributor"
    }
  }
}
```
Sets `echo_session` cookie (same options as OAuth flow).

**Error Responses**:
- `401` — Invalid credentials: `"Invalid email or password"` (generic, FR-010)
- `403` — Email not verified: `"Please verify your email address before logging in"` (includes `needsVerification: true`)
- `403` — Account deactivated
- `423` — Account locked (includes `lockedUntil` timestamp)

**Side Effects**:
- Records login attempt (success or failure)
- On failure: increments failed count, may trigger lockout
- On success: resets failed count, creates session, updates `lastLoginAt`
- Audit event: `auth.login` or `auth.login_failed`

---

## POST /auth/verify-email

Verify email address using token from verification link.

**Auth**: None (public, token-based)

**Request Body**:
```json
{
  "token": "base64url-encoded-token"
}
```

**Validation (Zod)**:
- `token`: `z.string().min(1)`

**Success Response** `200`:
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully. You can now log in."
  }
}
```

**Error Responses**:
- `400` — Invalid or already-used token
- `410` — Token expired

**Side Effects**:
- Sets `emailVerified = true` on user
- Marks token as used (`used_at` timestamp)
- Audit event: `auth.verify_email`

---

## POST /auth/resend-verification

Resend the verification email for an unverified account.

**Auth**: None (public)
**Rate Limit**: 3 per hour per email (FR-011)

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Success Response** `200`:
```json
{
  "success": true,
  "data": {
    "message": "If an unverified account exists with this email, a new verification email has been sent."
  }
}
```
Always returns success (no account enumeration).

**Error Responses**:
- `429` — Rate limit exceeded

**Side Effects**:
- Invalidates previous verification tokens for this user
- Generates new verification token (24h expiry)
- Sends verification email
- Audit event: `auth.resend_verification`

---

## POST /auth/forgot-password

Request a password reset link.

**Auth**: None (public)
**Rate Limit**: 3 per hour per email (FR-012)

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Success Response** `200`:
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a password reset link has been sent."
  }
}
```
Always returns success (no account enumeration, FR-010).

**Error Responses**:
- `429` — Rate limit exceeded

**Side Effects**:
- Only sends email if account exists with `provider='email'`
- Invalidates previous reset tokens for this user
- Generates reset token (1h expiry)
- Sends password reset email
- Audit event: `auth.password_reset_requested`

---

## POST /auth/reset-password

Set a new password using a reset token.

**Auth**: None (public, token-based)

**Request Body**:
```json
{
  "token": "base64url-encoded-token",
  "password": "NewP@ssw0rd"
}
```

**Validation (Zod)**:
- `token`: `z.string().min(1)`
- `password`: `z.string().min(8).max(128)` + custom 3-of-4-types validator

**Success Response** `200`:
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully. You can now log in with your new password."
  }
}
```

**Error Responses**:
- `400` — Invalid, used, or expired token
- `400` — New password doesn't meet requirements

**Side Effects**:
- Hashes and stores new password
- Marks reset token as used
- Revokes ALL active sessions for user (FR-008)
- Resets failed login count
- Audit event: `auth.password_reset`

---

## PUT /auth/change-password

Change password while logged in.

**Auth**: Required (cookie session)

**Request Body**:
```json
{
  "currentPassword": "OldP@ssw0rd",
  "newPassword": "NewP@ssw0rd"
}
```

**Validation (Zod)**:
- `currentPassword`: `z.string().min(1)`
- `newPassword`: `z.string().min(8).max(128)` + custom 3-of-4-types validator

**Success Response** `200`:
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully."
  }
}
```

**Error Responses**:
- `400` — New password doesn't meet requirements
- `401` — Not authenticated
- `403` — Current password incorrect
- `403` — User is OAuth-only (no password to change)

**Side Effects**:
- Verifies current password with argon2
- Hashes and stores new password
- Revokes all OTHER sessions (current session preserved, FR-023)
- Audit event: `auth.password_changed`

---

## Modified: GET /auth/callback/:provider

**Change**: Update `findOrCreateUser()` to reject email conflicts.

**New Error Response** — Redirect with `?error=provider_conflict&existing_provider=email`:
- When OAuth email matches an existing `provider='email'` user
- Frontend shows: "An account with this email already exists. Please log in with your email and password."

**Symmetric**: `POST /auth/register` returns 409 when email matches an existing OAuth user.

---

## Response Envelope

All endpoints follow existing pattern:
```typescript
function success(c: Context, data: unknown, status = 200) {
  return c.json({ success: true, data }, status);
}

function error(c: Context, message: string, status: number, details?: unknown) {
  return c.json({ success: false, error: { message, ...details } }, status);
}
```
