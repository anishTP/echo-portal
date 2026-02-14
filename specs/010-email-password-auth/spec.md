# Feature Specification: Email/Password Authentication

**Feature Branch**: `010-email-password-auth`
**Created**: 2026-02-13
**Status**: Draft
**Input**: User description: "Add email/password authentication alongside existing OAuth so anyone can sign up and log in without requiring a GitHub or Google account"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Email Signup (Priority: P1)

A new user visits the platform and wants to create an account using their email address. They don't have or don't want to use a GitHub or Google account. They provide their email, a password, and a display name. The system sends a verification email. After clicking the verification link, they can log in and start using the platform as a contributor.

**Why this priority**: This is the core feature — without signup, no other email/password functionality matters. It removes the biggest barrier to adoption: requiring a social account.

**Independent Test**: Can be fully tested by visiting the signup page, creating an account, verifying email, and logging in. Delivers immediate value — a new user can access the platform.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on the signup page, **When** they provide a valid email, password, and display name, **Then** the system creates their account and sends a verification email.
2. **Given** a user who has received a verification email, **When** they click the verification link within 24 hours, **Then** their account is activated and they can log in.
3. **Given** a user who has not verified their email, **When** they attempt to log in, **Then** they are informed their email is not yet verified and offered to resend verification.
4. **Given** a user attempting to sign up, **When** they provide an email already associated with an existing account, **Then** they are informed the email is already in use (without revealing which auth method the existing account uses).
5. **Given** a new user who completes signup and verification, **When** they log in for the first time, **Then** they are assigned the default "contributor" role.

---

### User Story 2 - Email/Password Login (Priority: P1)

A returning user who signed up with email/password wants to log in. They enter their email and password on the login page alongside the existing OAuth buttons. After successful authentication, they are taken to the dashboard with their full session and role-based access.

**Why this priority**: Login is equally critical to signup — users must be able to return to the platform. Shares P1 because signup without login is incomplete.

**Independent Test**: Can be tested by logging in with valid credentials and verifying session is created, then attempting with invalid credentials and verifying rejection.

**Acceptance Scenarios**:

1. **Given** a verified user on the login page, **When** they enter correct email and password, **Then** they are authenticated and redirected to the dashboard.
2. **Given** a user on the login page, **When** they enter incorrect credentials, **Then** they see a generic "Invalid email or password" message (not revealing which field is wrong).
3. **Given** a user who has failed login 5 times within an hour, **When** they attempt another login, **Then** their account is locked for 15 minutes (using existing lockout system).
4. **Given** a user whose account has been deactivated by an admin, **When** they attempt to log in, **Then** they are denied access with an appropriate message.

---

### User Story 3 - Email Delivery Service (Priority: P1)

The platform needs the ability to send transactional emails for verification and password reset. In production, emails are delivered via a configurable email service. In development, emails are logged to the console for easy testing.

**Why this priority**: Shares P1 because without email delivery, neither signup verification nor password reset can function. It is a prerequisite for all email-dependent flows.

**Independent Test**: Can be tested by triggering a verification email and confirming it is delivered (production) or logged (development).

**Acceptance Scenarios**:

1. **Given** a signup or password reset action, **When** an email needs to be sent, **Then** the system delivers it through the configured email service.
2. **Given** a development environment, **When** an email would be sent, **Then** the email content is logged to the console instead.
3. **Given** an email delivery failure, **When** the send fails, **Then** the system logs the failure without exposing the error to the user, and the user is advised to retry later.

---

### User Story 4 - Password Reset (Priority: P2)

A user who signed up with email/password has forgotten their password. They request a password reset from the login page. The system sends a reset link to their email. They click the link, set a new password, and can log in again.

**Why this priority**: Essential for self-service account recovery. Without this, users who forget their password are permanently locked out, creating support burden.

**Independent Test**: Can be tested by requesting a reset, clicking the link, setting a new password, and logging in with the new password.

**Acceptance Scenarios**:

1. **Given** a user on the login page, **When** they click "Forgot password?" and enter their email, **Then** they see a confirmation message regardless of whether the email exists (no account enumeration).
2. **Given** a user with a valid reset link, **When** they click it within 1 hour and set a new password, **Then** their password is updated and all existing sessions are invalidated.
3. **Given** a user with a reset link, **When** they attempt to use it after 1 hour, **Then** they are informed the link has expired and can request a new one.
4. **Given** a user with a reset link, **When** they use it once successfully, **Then** the link cannot be used again.

---

### User Story 5 - Unified Login Page (Priority: P2)

All users — whether they prefer OAuth or email/password — see a single, cohesive login page that presents both options clearly. The current header-based OAuth buttons are replaced with a dedicated login page that serves as the entry point for all authentication methods.

**Why this priority**: A dedicated login page improves discoverability and provides space for the email/password form. Currently login is only via header buttons which cannot accommodate a form.

**Independent Test**: Can be tested by visiting the login page and verifying both OAuth buttons and email/password form are present and functional.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they visit the platform, **Then** they see a "Sign In" link in the header that navigates to the dedicated login page.
2. **Given** an unauthenticated user on the login page, **When** they view the page, **Then** they see OAuth buttons (GitHub, Google) and an email/password form.
3. **Given** a user on the login page, **When** they choose any auth method, **Then** the method works and creates a session.
4. **Given** a user on the login page, **When** they need to create an account, **Then** there is a clear link to the signup page.

---

### User Story 6 - Email Verification Resend (Priority: P3)

A user who signed up but never received or lost their verification email needs to request it again. They can do this from the login page when prompted or from a dedicated verification page.

**Why this priority**: Important for recovering stuck signups, but a secondary flow compared to the primary signup and login paths.

**Independent Test**: Can be tested by signing up, not verifying, then requesting a resend and verifying via the new email.

**Acceptance Scenarios**:

1. **Given** an unverified user, **When** they request a verification resend, **Then** a new verification email is sent (invalidating previous tokens).
2. **Given** a user requesting multiple resends, **When** they exceed 3 requests per hour, **Then** further requests are rate-limited with an appropriate message.

---

### User Story 7 - Change Password While Logged In (Priority: P3)

A logged-in user who signed up with email/password wants to change their password proactively — for example, if they suspect it has been compromised. They navigate to their profile or account settings, provide their current password for verification, and set a new one.

**Why this priority**: Important security hygiene feature, but lower priority than the core signup/login/reset flows since users can always use forgot-password as a fallback.

**Independent Test**: Can be tested by logging in, navigating to settings, entering current password, setting a new one, and verifying the new password works on next login.

**Acceptance Scenarios**:

1. **Given** a logged-in email/password user on their account settings, **When** they provide their current password and a valid new password, **Then** their password is updated and all other active sessions are invalidated.
2. **Given** a logged-in email/password user, **When** they provide an incorrect current password, **Then** the change is rejected with an error message.
3. **Given** a logged-in user who signed up via OAuth only, **When** they visit account settings, **Then** the password change option is not displayed (they have no password to change).

---

### Edge Cases

- What happens when a user who signed up via OAuth tries to sign up with the same email via email/password? They should be told the email is already in use and directed to log in with their existing auth method.
- What happens when an email/password user tries to log in via OAuth with the same email? The OAuth login is blocked and the user is directed to log in with their email and password instead.
- What happens when a user clicks a verification link but their account was deleted or deactivated by an admin? They should see an appropriate error.
- What happens when a user requests a password reset for an email that was registered via OAuth only? The system should respond identically to prevent account enumeration but not send a reset link (since there's no password to reset).
- What happens when an email/password user's session expires? They should be redirected to the login page.
- What happens when the email delivery service is unavailable? Signup should still succeed but the user should be told to retry verification later.
- What happens with concurrent password reset requests? Only the most recent token should be valid.
- What happens when an unverified account is older than 7 days? It is automatically purged, and the email becomes available for a fresh signup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create accounts using email, password, and display name.
- **FR-002**: System MUST validate that passwords meet minimum security requirements: at least 8 characters and at least 3 of 4 character types (uppercase letter, lowercase letter, number, special character).
- **FR-003**: System MUST send a verification email upon signup with a time-limited confirmation link (24-hour expiry).
- **FR-004**: System MUST NOT allow unverified email accounts to log in.
- **FR-005**: System MUST authenticate email/password users and create sessions identical to OAuth sessions.
- **FR-006**: System MUST integrate email/password login attempts with the existing account lockout system (5 failed attempts within 1 hour triggers 15-minute lockout).
- **FR-007**: System MUST provide a self-service password reset flow via email with time-limited, single-use reset tokens (1-hour expiry).
- **FR-008**: System MUST invalidate all active sessions when a user's password is reset via a reset token (see FR-023 for change-password behavior).
- **FR-009**: System MUST assign the default "contributor" role to new email/password signups.
- **FR-010**: System MUST NOT reveal whether an email is registered in the system through error messages on the forgot-password flow.
- **FR-011**: System MUST rate-limit verification email resends (maximum 3 per hour per email).
- **FR-012**: System MUST rate-limit password reset requests (maximum 3 per hour per email).
- **FR-013**: System MUST rate-limit signup attempts (maximum 5 per hour per IP address).
- **FR-014**: System MUST store passwords using a secure, modern one-way hashing algorithm with appropriate cost factors.
- **FR-015**: System MUST never return password hashes in any response.
- **FR-016**: System MUST provide a unified login page with both OAuth and email/password options, accessible via a "Sign In" link in the header (replacing the current inline OAuth buttons).
- **FR-017**: System MUST support a configurable email delivery service with a development mode that logs to console.
- **FR-018**: System MUST display real-time password strength feedback during signup.
- **FR-019**: System MUST log all authentication events (signup, login, verification, password reset) in the existing audit trail.
- **FR-020**: System MUST use timing-safe comparisons for all token and credential validation to prevent timing attacks.
- **FR-021**: System MUST automatically purge unverified accounts after 7 days, freeing the email address for re-registration.
- **FR-022**: System MUST allow logged-in email/password users to change their password by verifying their current password first.
- **FR-023**: System MUST invalidate all other active sessions when a user changes their password (current session remains active).
- **FR-024**: System MUST enforce single-provider-per-email — if an email is already registered via one auth method (OAuth or email/password), attempts to use or register via a different auth method with the same email MUST be blocked with a message directing the user to their existing auth method.

### Key Entities

- **User Credentials**: Password hash linked to a user account. A user has either credentials (email/password) or an OAuth provider, but not both (see FR-024). The email serves as the shared identity across auth methods.
- **Verification Token**: A cryptographically secure, time-limited token sent via email to confirm ownership of an email address. Single-use, expires after 24 hours.
- **Password Reset Token**: A cryptographically secure, time-limited token sent via email to authorize a password change. Single-use, expires after 1 hour.
- **Email Message**: A transactional email (verification or password reset) queued for delivery through the configured email service.

### Actors and Permissions *(mandatory per Constitution VIII)*

| Role/Actor             | Permissions                                                                   | Authentication Required |
|------------------------|-------------------------------------------------------------------------------|-------------------------|
| **Anonymous User**     | Sign up, log in (email/password or OAuth), request password reset, verify email | No                      |
| **Unverified User**    | Resend verification email, cannot access any platform features                | No (identified by token) |
| **Authenticated User** | All existing contributor permissions; change own password                      | Yes                     |
| **Administrator**      | All existing admin permissions; unlock locked accounts (already exists)        | Yes                     |

### Lifecycle States and Transitions *(mandatory per Constitution VIII)*

**Account States**:
- **Unverified**: Account created but email not yet confirmed. Cannot log in.
- **Active**: Email verified, account in good standing. Full access per role.
- **Locked**: Temporarily locked due to failed login attempts. Cannot log in for 15 minutes.
- **Deactivated**: Disabled by administrator. Cannot log in.

**Valid Transitions**:
```
Unverified → Active (by: User clicking verification link)
Active → Locked (by: System after 5 failed login attempts)
Locked → Active (by: System after lockout expires, or Admin manual unlock)
Active → Deactivated (by: Administrator)
Deactivated → Active (by: Administrator)
```

### Visibility Boundaries *(mandatory per Constitution VIII)*

| Data                | Visibility      | Who Can Access                            |
|---------------------|-----------------|-------------------------------------------|
| User's own profile  | Private         | The user themselves, administrators       |
| Password hash       | Never exposed   | System internal only — never in responses |
| Verification tokens | Private         | Sent only to the user's email             |
| Reset tokens        | Private         | Sent only to the user's email             |
| Account existence   | Protected       | Not revealed via error messages            |
| Failed login count  | Private         | Administrators only                       |
| Audit logs          | Restricted      | Administrators only                       |

### Auditability and Traceability *(mandatory per Constitution VIII)*

**Required Audit Events**:
- Account created via email/password (actor, timestamp, email)
- Email verification completed (actor, timestamp)
- Email verification resent (actor, timestamp)
- Login succeeded via email/password (actor, timestamp, IP)
- Login failed via email/password (timestamp, email, IP — no actor since auth failed)
- Password reset requested (timestamp, email, IP)
- Password reset completed (actor, timestamp, IP)
- Password changed by user (actor, timestamp)
- Account locked due to failed attempts (timestamp, email)

**Audit Log Format**: Uses existing audit log system — each entry includes timestamp, actor, action, resource, and metadata.

**Retention Policy**: Same as existing audit log retention policy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full signup flow (form submission through email verification) in under 3 minutes.
- **SC-002**: Users can log in with email and password in under 10 seconds.
- **SC-003**: Users can complete the password reset flow (request through new login) in under 5 minutes.
- **SC-004**: 95% of verification and reset emails are delivered within 60 seconds.
- **SC-005**: Zero password hashes are exposed in any user-facing response.
- **SC-006**: All authentication events are captured in the audit trail with no gaps.
- **SC-007**: Account lockout activates correctly after exactly 5 failed attempts.

### Verification Requirements *(mandatory per Constitution VIII)*

**Acceptance Tests**:
- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified
- [ ] All account state transitions tested
- [ ] All permission checks validated
- [ ] All audit events logged correctly
- [ ] Rate limiting enforced on all protected endpoints
- [ ] Password security requirements enforced

**Test Coverage**:
- Core workflows: 80% minimum (Constitution X)
- Edge cases: All documented edge cases have test coverage
- Integration tests: All state transitions and actor interactions

**Validation Procedures**:
1. End-to-end walkthrough of signup, verification, login, and password reset flows
2. Security review: password storage, token generation, timing-safe comparisons, rate limiting
3. Verify no account enumeration is possible through any error message or timing difference
4. Verify email/password auth creates identical sessions to OAuth auth
5. Verify existing OAuth flows remain unaffected

**Sign-off Criteria**:
- [ ] All acceptance scenarios pass
- [ ] Security review completed
- [ ] Email delivery confirmed in both production and development modes
- [ ] Existing OAuth login unaffected (regression test)
- [ ] Documentation complete and reviewed

## Clarifications

### Session 2026-02-13

- Q: What happens to unverified accounts over time — do they persist indefinitely or expire? → A: Unverified accounts expire after 7 days and are automatically purged, freeing the email for re-registration.
- Q: Should logged-in email/password users be able to change their password from a settings page? → A: Yes, include self-service password change requiring current password verification.
- Q: What happens when someone tries to use a different auth method with an already-registered email? → A: Block the second provider and direct the user to log in with their existing auth method (no duplicate accounts, no auto-linking).
- Q: What do unauthenticated users see in the header navigation? → A: A "Sign In" link/button that navigates to the dedicated login page (replaces current inline OAuth buttons).
- Q: What are the specific password complexity requirements? → A: Minimum 8 characters, must include at least 3 of 4 character types (uppercase, lowercase, number, special character).

## Assumptions

- The existing session management system (cookie-based, 24-hour sliding expiry) will be reused for email/password sessions — no new session mechanism needed.
- The existing account lockout system (5 attempts / 1 hour / 15-minute lock) will be reused — no changes to lockout logic.
- The existing role system and admin user management UI (including role promotion) will be reused — no changes needed.
- Email delivery in development will use console logging; production email service provider will be configurable via environment variables.
- Account linking (connecting OAuth and email/password for the same user) is out of scope for this feature and may be addressed in a future iteration.
- Two-factor authentication (2FA/MFA) is out of scope for this feature.
- SAML/SSO integration is out of scope for this feature.

## Out of Scope

- Account linking between OAuth and email/password providers
- Two-factor authentication (2FA/MFA)
- SAML/SSO enterprise authentication
- Social login providers beyond existing GitHub and Google
- User self-service account deletion
- Email change flow (changing registered email address)
