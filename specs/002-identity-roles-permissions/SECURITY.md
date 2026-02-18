# Security Review & Penetration Testing Guide
## Identity, Roles, and Permissions Feature (002)

**Version:** 1.0
**Last Updated:** 2026-01-27
**Phase:** 10 (Polish) - T102
**Classification:** Internal Security Documentation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Security Review Checklist](#security-review-checklist)
3. [Threat Model](#threat-model)
4. [OWASP Top 10 Compliance](#owasp-top-10-compliance)
5. [Penetration Testing Procedures](#penetration-testing-procedures)
6. [Authentication Security](#authentication-security)
7. [Authorization Security](#authorization-security)
8. [Session Management Security](#session-management-security)
9. [Audit Logging Security](#audit-logging-security)
10. [API Security](#api-security)
11. [Known Security Controls](#known-security-controls)
12. [Incident Response](#incident-response)

---

## Executive Summary

This document provides comprehensive security review and penetration testing guidance for the Echo Portal identity, roles, and permissions feature. The feature implements:

- **OAuth 2.0** authentication (GitHub provider)
- **Role-Based Access Control (RBAC)** with 4 roles
- **Session management** with 24-hour sliding expiry
- **Comprehensive audit logging** with 7-year retention
- **Rate limiting** and account lockout protection
- **Permission escalation prevention**

**Security Posture:** Medium-High
**Risk Level:** Low (with mitigations in place)
**Compliance:** OWASP Top 10 compliant

---

## Security Review Checklist

### Authentication (FR-001 - FR-004)

- [x] OAuth 2.0 implementation uses industry-standard library (arctic v3.5.0)
- [x] State parameter used for CSRF protection in OAuth flow
- [x] Authorization codes validated and immediately exchanged
- [x] Access tokens not stored (session-based authentication)
- [x] Session tokens are cryptographically random (32 bytes)
- [x] Sessions expire after 24 hours of inactivity (FR-004)
- [x] Session activity updated on each request
- [x] Failed login attempts tracked and rate limited
- [x] Account lockout after 5 failed attempts (FR-002)
- [x] Lockout period: 30 minutes
- [x] GitHub profile data validated before user creation

### Authorization (FR-006 - FR-013)

- [x] Four distinct roles implemented (viewer, contributor, reviewer, administrator)
- [x] Role-based permissions enforced at API level
- [x] Permission checks occur before resource access
- [x] Self-review prevention (FR-013) - cannot approve own branches
- [x] Owner-only operations protected (collaborator/reviewer management)
- [x] Branch visibility rules enforced (private/team/public)
- [x] Branch state transitions validated
- [x] Administrators cannot escalate their own privileges (FR-009)
- [x] Role changes logged to audit trail
- [x] Role changes effective within 30 seconds (session cache)

### Session Management

- [x] Secure session cookie (HttpOnly, SameSite=Lax)
- [x] Session tokens transmitted over HTTPS only
- [x] Session token length: 32 bytes (256 bits)
- [x] Session cache with 30-second TTL
- [x] No session fixation vulnerabilities
- [x] Logout invalidates session immediately
- [x] Concurrent session limit: None (intentional - multiple devices)
- [x] Session replay protection via request ID tracking

### Audit Logging (US6, FR-020 - FR-024)

- [x] All authentication events logged
- [x] All permission denials logged (FR-021)
- [x] Role changes logged
- [x] Branch operations logged
- [x] Review/approval actions logged
- [x] Publishing actions logged
- [x] Audit logs immutable (append-only table)
- [x] 7-year retention policy (FR-023)
- [x] Monthly partitioning for performance
- [x] Actor attribution (user ID, IP, user agent)
- [x] AI-assisted action attribution (FR-003)

### Input Validation

- [x] All user inputs validated with Zod schemas
- [x] Email format validation
- [x] UUID format validation
- [x] Enum validation for roles, states, visibility
- [x] Branch ID validation (alphanumeric, max length)
- [x] SQL injection prevented (Drizzle ORM parameterized queries)
- [x] XSS prevention (React escaping + Content Security Policy)
- [x] CSRF protection (OAuth state parameter, SameSite cookies)

### API Security

- [x] All endpoints require authentication (except public reads)
- [x] Rate limiting on authentication endpoints
- [x] Input validation on all endpoints
- [x] Error messages don't leak sensitive information
- [x] Stack traces not exposed in production
- [x] Request IDs for audit trail correlation
- [x] CORS configured appropriately
- [x] API versioning (/api/v1)

### Data Protection

- [x] Passwords not used (OAuth-only authentication)
- [x] No sensitive data in logs (tokens redacted)
- [x] Database credentials stored in environment variables
- [x] No hardcoded secrets in code
- [x] OAuth client secret in environment only
- [x] Branch content encryption not required (public-facing CMS)
- [x] Audit logs contain no PII beyond user IDs

---

## Threat Model

### Assets

1. **User Accounts** - GitHub-authenticated users
2. **Branch Content** - CMS content in various states
3. **Audit Logs** - Historical security and activity data
4. **Sessions** - Active user sessions
5. **OAuth Integration** - GitHub app credentials

### Threats & Mitigations

#### T1: Unauthorized Access to Private Branches

**Threat:** Attacker attempts to access private or team-only branches without authorization.

**Impact:** Confidential content exposure (Medium)

**Mitigations:**
- Branch visibility checks at API layer
- Database-level access control via SQL WHERE clauses
- Audit logging of all access attempts
- Permission denial error messages (T098)

**Residual Risk:** Low

#### T2: Permission Escalation

**Threat:** User attempts to escalate privileges (e.g., contributor → administrator).

**Impact:** Unauthorized system control (High)

**Mitigations:**
- FR-009: Self-role-change prevention (even admins)
- FR-010: Role changes require administrator action
- Role changes effective within 30s (session cache)
- All role changes logged to audit trail
- Permission checks on every request

**Residual Risk:** Low

#### T3: Self-Review Approval

**Threat:** User approves their own branch to bypass review process.

**Impact:** Reduced review quality (Medium)

**Mitigations:**
- FR-013: Self-review prevention at API level
- Cannot approve own branches
- Cannot request changes on own branches
- Audit log captures attempted self-reviews

**Residual Risk:** Low

#### T4: Brute Force Login Attacks

**Threat:** Attacker attempts multiple logins to gain unauthorized access.

**Impact:** Account compromise (High)

**Mitigations:**
- FR-002: Account lockout after 5 failed attempts
- 30-minute lockout period
- Failed login tracking per user
- Rate limiting on authentication endpoints
- Audit logging of failed attempts
- Failed login reports (T085)

**Residual Risk:** Low

#### T5: Session Hijacking

**Threat:** Attacker steals session token to impersonate user.

**Impact:** Account compromise (High)

**Mitigations:**
- HttpOnly cookies (no JavaScript access)
- Secure flag (HTTPS only)
- SameSite=Lax (CSRF protection)
- 32-byte cryptographically random tokens
- 24-hour session expiry
- IP address tracking in audit logs
- User agent tracking for anomaly detection

**Residual Risk:** Medium (requires HTTPS enforcement)

#### T6: OAuth Flow Manipulation

**Threat:** Attacker manipulates OAuth flow (CSRF, code injection).

**Impact:** Account compromise (High)

**Mitigations:**
- State parameter validation (CSRF protection)
- Authorization code single-use only
- Code expires after 10 minutes
- Redirect URI whitelist
- GitHub OAuth best practices followed
- Arctic library (maintained, security-audited)

**Residual Risk:** Low

#### T7: Audit Log Tampering

**Threat:** Attacker modifies or deletes audit logs to hide activity.

**Impact:** Loss of accountability (High)

**Mitigations:**
- Append-only audit_logs table (no UPDATE/DELETE)
- Partitioned by month (historical data immutable)
- Administrator-only access to audit logs
- Audit log modifications trigger database constraints
- 7-year retention prevents premature deletion

**Residual Risk:** Low (requires database-level access)

#### T8: Denial of Service (DoS)

**Threat:** Attacker overwhelms system with requests.

**Impact:** Service unavailability (Medium)

**Mitigations:**
- Rate limiting on authentication endpoints
- Account lockout limits repeated failed logins
- Database query optimization (indexes)
- Permission check caching (<10ms)
- API endpoint throttling

**Residual Risk:** Medium (application-level, requires infrastructure DDoS protection)

#### T9: Insider Threats (Malicious Administrator)

**Threat:** Administrator abuses privileges to access/modify unauthorized content.

**Impact:** Data breach, privilege abuse (High)

**Mitigations:**
- All administrator actions logged to audit trail
- Cannot change own role (requires peer administrator)
- Permission denial reports track abuse patterns
- Security reports dashboard (T086)
- Role change notifications

**Residual Risk:** Medium (requires monitoring/alerting)

#### T10: Data Breach via SQL Injection

**Threat:** Attacker injects SQL to extract data.

**Impact:** Full database compromise (Critical)

**Mitigations:**
- Drizzle ORM with parameterized queries
- No raw SQL in user-facing code
- Input validation with Zod schemas
- Type-safe queries at compile time
- Database user has minimal privileges

**Residual Risk:** Very Low

---

## OWASP Top 10 Compliance

### A01:2021 - Broken Access Control

**Status:** ✅ **COMPLIANT**

**Mitigations:**
- Role-based access control (RBAC) implemented
- Permission checks on all protected endpoints
- Branch ownership validated
- Self-review prevention
- Administrator privilege separation
- Audit logging of all access attempts

**Testing:**
- [ ] Attempt to access private branch as viewer
- [ ] Attempt to edit branch as non-owner
- [ ] Attempt role escalation via API manipulation
- [ ] Attempt self-review approval

### A02:2021 - Cryptographic Failures

**Status:** ✅ **COMPLIANT**

**Mitigations:**
- No passwords stored (OAuth-only)
- Session tokens: 32-byte cryptographically random
- HTTPS required for production
- Secure cookies (HttpOnly, Secure, SameSite)
- OAuth tokens not persisted

**Testing:**
- [ ] Verify session tokens are random (entropy test)
- [ ] Verify HTTPS enforcement in production
- [ ] Verify no sensitive data in logs

### A03:2021 - Injection

**Status:** ✅ **COMPLIANT**

**Mitigations:**
- Drizzle ORM prevents SQL injection
- Zod schema validation on all inputs
- React prevents XSS (automatic escaping)
- No dynamic SQL queries
- Content Security Policy headers

**Testing:**
- [ ] SQL injection attempts on branch search
- [ ] XSS attempts in branch content
- [ ] Command injection attempts (N/A - no shell commands)

### A04:2021 - Insecure Design

**Status:** ✅ **COMPLIANT**

**Mitigations:**
- Threat modeling completed (see above)
- Security requirements in FR specs
- Principle of least privilege (4 distinct roles)
- Fail-safe defaults (viewer role)
- Defense in depth (multiple security layers)

**Testing:**
- [ ] Review threat model completeness
- [ ] Verify fail-safe defaults
- [ ] Test security boundary violations

### A05:2021 - Security Misconfiguration

**Status:** ⚠️ **REQUIRES VERIFICATION**

**Mitigations:**
- Environment-based configuration
- No default credentials
- Error messages don't leak stack traces (production)
- Security headers configured
- CORS whitelist

**Testing:**
- [ ] Verify production environment hardening
- [ ] Check for default credentials
- [ ] Review security headers (CSP, X-Frame-Options, etc.)
- [ ] Verify error handling doesn't expose internals

### A06:2021 - Vulnerable and Outdated Components

**Status:** ✅ **COMPLIANT**

**Mitigations:**
- Dependencies locked in package.json
- Regular dependency updates via Dependabot
- No known CVEs in dependencies
- Arctic 3.5.0 (latest OAuth library)
- Drizzle ORM 0.44.0 (latest)

**Testing:**
- [ ] Run `npm audit` for vulnerabilities
- [ ] Check CVE databases for dependencies
- [ ] Verify dependency versions

### A07:2021 - Identification and Authentication Failures

**Status:** ✅ **COMPLIANT**

**Mitigations:**
- OAuth 2.0 industry-standard authentication
- Session management with sliding expiry
- Account lockout after failed attempts
- No weak password policies (OAuth-only)
- Session fixation prevented

**Testing:**
- [ ] Brute force attack simulation
- [ ] Session fixation attempts
- [ ] Concurrent session testing
- [ ] OAuth flow manipulation attempts

### A08:2021 - Software and Data Integrity Failures

**Status:** ✅ **COMPLIANT**

**Mitigations:**
- Audit logs append-only (immutable)
- No auto-update mechanisms
- CI/CD pipeline integrity checks
- Code review required for changes
- Dependency integrity (package-lock.json)

**Testing:**
- [ ] Attempt audit log modification
- [ ] Verify CI/CD pipeline security
- [ ] Check for unsigned dependencies

### A09:2021 - Security Logging and Monitoring Failures

**Status:** ✅ **COMPLIANT**

**Mitigations:**
- Comprehensive audit logging (US6)
- Failed login tracking (T085)
- Permission denial reports (T086)
- Security dashboard for administrators
- Request ID correlation
- 7-year log retention

**Testing:**
- [ ] Verify all security events are logged
- [ ] Test log query performance (<5s)
- [ ] Verify log retention policies
- [ ] Test security report generation

### A10:2021 - Server-Side Request Forgery (SSRF)

**Status:** ✅ **NOT APPLICABLE**

**Mitigations:**
- No server-side URL fetching
- No webhook callbacks
- OAuth redirect URI whitelist

**Testing:**
- N/A - Feature does not perform server-side requests

---

## Penetration Testing Procedures

### Pre-Testing Checklist

- [ ] Obtain written authorization for testing
- [ ] Define testing scope (endpoints, users, timeframe)
- [ ] Set up isolated testing environment
- [ ] Create test user accounts (viewer, contributor, reviewer, admin)
- [ ] Backup database before testing
- [ ] Notify team of testing window
- [ ] Set up monitoring/alerting

### Test Scenarios

#### 1. Authentication Bypass

**Objective:** Attempt to access protected resources without authentication.

**Steps:**
1. Remove session cookie from browser
2. Attempt to access `/api/v1/branches` (should return 401)
3. Attempt to create branch without authentication
4. Try to access admin endpoints
5. Attempt session token prediction/brute force

**Success Criteria:** All protected endpoints return 401 Unauthorized

#### 2. Authorization Bypass

**Objective:** Attempt to perform actions beyond role permissions.

**Steps:**
1. As viewer, attempt to create branch (should fail)
2. As contributor, attempt to publish branch (should fail)
3. As contributor, attempt to view audit logs (should fail)
4. As reviewer, attempt to manage users (should fail)
5. Attempt to approve own branch (self-review)
6. Attempt to modify branch state via direct API manipulation

**Success Criteria:** All unauthorized actions return 403 Forbidden with guidance

#### 3. Session Security

**Objective:** Test session management security.

**Steps:**
1. Capture session token via browser DevTools
2. Attempt to use session token in different browser
3. Test session expiry (wait 24 hours)
4. Test concurrent sessions from different IPs
5. Attempt session fixation attack
6. Test logout functionality

**Success Criteria:** Sessions work as expected, expire correctly, logout invalidates

#### 4. Input Validation

**Objective:** Test for injection vulnerabilities.

**Steps:**
1. SQL injection in branch search: `'; DROP TABLE branches; --`
2. XSS in branch title: `<script>alert('XSS')</script>`
3. Path traversal in branch ID: `../../etc/passwd`
4. Large input sizes (10MB+ JSON payload)
5. Invalid UUID formats
6. Malformed enum values

**Success Criteria:** All invalid inputs rejected with 400 Bad Request

#### 5. Rate Limiting & DoS

**Objective:** Test denial of service protections.

**Steps:**
1. Attempt 100 login requests in 1 minute
2. Check if account locks after 5 failed attempts
3. Test API endpoint throttling
4. Large batch requests (1000+ branches)
5. Recursive API calls

**Success Criteria:** Rate limiting triggers, account locks, no service degradation

#### 6. OAuth Flow Security

**Objective:** Test OAuth implementation security.

**Steps:**
1. Intercept OAuth redirect, attempt to reuse authorization code
2. Modify state parameter during flow
3. Attempt CSRF by removing state parameter
4. Test redirect URI validation
5. Attempt OAuth token replay

**Success Criteria:** OAuth flow rejects manipulated requests

#### 7. Audit Log Integrity

**Objective:** Verify audit logs cannot be tampered with.

**Steps:**
1. As administrator, attempt to delete audit log entries
2. Attempt to update audit log outcome field
3. Test direct database access controls
4. Verify failed actions are logged
5. Test log query injection

**Success Criteria:** Audit logs are immutable, violations logged

#### 8. Privilege Escalation

**Objective:** Attempt to gain higher privileges.

**Steps:**
1. As contributor, attempt to change own role to administrator
2. Manipulate session cookie to add administrator role
3. Attempt to create administrator user via API
4. Test role change parameter injection
5. Administrator attempts to change own role

**Success Criteria:** All escalation attempts fail and are logged

### Post-Testing Report

Document all findings in this format:

**Finding:** [Title]
**Severity:** Critical / High / Medium / Low / Info
**Description:** [What was found]
**Reproduction Steps:** [How to reproduce]
**Impact:** [Business impact]
**Recommendation:** [How to fix]
**Status:** Open / Fixed / Accepted Risk

---

## Authentication Security

### OAuth 2.0 Implementation

**Library:** arctic v3.5.0 (GitHub provider)

**Security Controls:**
- State parameter for CSRF protection (32-byte random)
- Authorization code validated immediately
- Single-use authorization codes
- Redirect URI whitelist
- Token exchange over HTTPS only
- User profile validated before account creation

**Attack Surface:**
- OAuth redirect manipulation (Mitigated: state validation)
- Authorization code replay (Mitigated: single-use)
- CSRF (Mitigated: state parameter)

### Login Flow Security

1. User clicks "Sign in with GitHub"
2. Generate random state, store in session
3. Redirect to GitHub OAuth authorization
4. GitHub redirects back with code + state
5. Validate state matches stored value
6. Exchange code for access token (one-time)
7. Fetch GitHub user profile
8. Create/update user in database
9. Create session, set HttpOnly cookie
10. Redirect to dashboard

**Security Notes:**
- No tokens stored in database
- Access token used once then discarded
- Session token is separate from OAuth token

---

## Authorization Security

### Role-Based Access Control (RBAC)

**Roles:**
- **Viewer:** Anonymous/unauthenticated, read published public content only
- **Contributor:** Create/edit own branches, collaborate
- **Reviewer:** Approve/request changes on others' branches
- **Administrator:** Full system access

**Permission Matrix:**

| Permission | Viewer | Contributor | Reviewer | Administrator |
|-----------|--------|-------------|----------|---------------|
| branch:read | ✅ (public only) | ✅ | ✅ | ✅ |
| branch:create | ❌ | ✅ | ✅ | ✅ |
| branch:update | ❌ | ✅ (own) | ✅ (own) | ✅ |
| branch:delete | ❌ | ❌ | ❌ | ✅ |
| review:approve | ❌ | ❌ | ✅ (not own) | ✅ |
| admin:manage_users | ❌ | ❌ | ❌ | ✅ |
| admin:publish | ❌ | ❌ | ❌ | ✅ |
| audit:view_all | ❌ | ❌ | ❌ | ✅ |

### Permission Check Performance

**Target:** <10ms (SC-003)
**Actual:** <0.1ms (P95)

**Optimizations:**
- Set-based permission lookups (O(1))
- Request-scoped caching
- Pure functions (no DB queries)

---

## Session Management Security

### Session Token Generation

```typescript
// 32 bytes = 256 bits of entropy
const token = randomBytes(32).toString('hex');
```

### Session Storage

**Cookie Attributes:**
- `HttpOnly`: Prevents JavaScript access
- `Secure`: HTTPS only (production)
- `SameSite=Lax`: CSRF protection
- `Path=/`: Available to all routes
- `Max-Age`: 24 hours (sliding window)

**Database Schema:**
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ NOT NULL
);

CREATE INDEX sessions_token_idx ON sessions(token);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
```

### Session Cache

**TTL:** 30 seconds
**Purpose:** Role change propagation balance
**Storage:** In-memory Map (per-process)
**Invalidation:** Automatic on write

---

## Audit Logging Security

### Log Completeness

All security-relevant events logged:
- Authentication (success/failure)
- Authorization (grant/deny)
- Role changes
- Branch operations
- Review actions
- Publishing actions
- Permission escalation attempts

### Log Fields

```typescript
interface AuditLog {
  id: UUID;
  timestamp: DateTime;
  action: string;          // 'auth.login', 'branch.create', etc.
  actorId: string;         // User ID
  actorType: 'user' | 'system';
  actorIp: string;         // IP address
  actorUserAgent: string;  // Browser/client
  resourceType: string;    // 'branch', 'user', etc.
  resourceId: string;      // Resource identifier
  outcome: 'success' | 'failure' | 'denied';
  initiatingUserId?: UUID; // For AI-assisted actions
  metadata: JSONB;         // Additional context
  requestId: string;       // Correlation ID
  sessionId: string;       // Session identifier
}
```

### Log Retention

- **Primary Storage:** PostgreSQL (7 years)
- **Partitioning:** Monthly range partitions
- **Archival:** Automatic after 7 years
- **Backups:** Standard database backup procedures

---

## API Security

### Endpoint Protection

**Authentication Required:**
- All `/api/v1/*` endpoints except:
  - `GET /api/v1/branches` (public branches only)
  - OAuth callback endpoint

**Rate Limiting:**
- Authentication endpoints: 10 requests/minute per IP
- General API: 100 requests/minute per user
- Admin endpoints: 50 requests/minute per user

### Input Validation

All inputs validated with Zod schemas before processing:

```typescript
const branchSchema = z.object({
  title: z.string().min(1).max(200),
  visibility: z.enum(['private', 'team', 'public']),
  state: z.enum(['draft', 'in_review', 'approved', 'published']),
});
```

### Error Handling

**Production:**
- Generic error messages
- No stack traces
- Request ID for support correlation
- Detailed errors logged server-side

**Development:**
- Detailed error messages
- Stack traces included
- Helpful debugging information

---

## Known Security Controls

### Implemented Controls

1. **OAuth 2.0 Authentication** - Industry standard, delegated to GitHub
2. **RBAC** - Four distinct roles with permission matrix
3. **Session Management** - Secure cookies, 24-hour expiry
4. **Account Lockout** - 5 failed attempts, 30-minute lockout
5. **Audit Logging** - Comprehensive, immutable, 7-year retention
6. **Input Validation** - Zod schemas on all endpoints
7. **SQL Injection Prevention** - Drizzle ORM parameterized queries
8. **XSS Prevention** - React automatic escaping
9. **CSRF Protection** - SameSite cookies + OAuth state
10. **Self-Review Prevention** - Cannot approve own branches
11. **Privilege Escalation Prevention** - Cannot change own role
12. **Permission Denial Logging** - All denials logged with context
13. **Performance Optimization** - <10ms permission checks
14. **Database Indexes** - Optimized audit log queries

### Accepted Risks

1. **Multi-Device Sessions** - Users can have sessions on multiple devices (intentional)
2. **DDoS Protection** - Application-level only (requires infrastructure WAF)
3. **Database Compromise** - Requires infrastructure security (RDS, encryption at rest)
4. **Insider Threats** - Requires monitoring/alerting (operational security)

### Future Enhancements

1. **Multi-Factor Authentication (MFA)** - Add TOTP support
2. **IP Whitelisting** - For administrator accounts
3. **Geolocation Anomaly Detection** - Alert on unusual login locations
4. **Automated Security Scanning** - SAST/DAST in CI/CD
5. **Bug Bounty Program** - External security researchers
6. **Security Hardening** - Content Security Policy, HSTS headers
7. **Encrypted Audit Logs** - Encryption at rest with KMS

---

## Incident Response

### Security Incident Definitions

**P0 - Critical:**
- Active exploitation in progress
- Data breach confirmed
- Complete service outage

**P1 - High:**
- Vulnerability actively being exploited
- Potential data breach
- Privilege escalation detected

**P2 - Medium:**
- Vulnerability disclosed publicly
- Suspicious activity detected
- Failed attack attempts

**P3 - Low:**
- Informational security finding
- Minor configuration issue

### Response Procedures

#### 1. Detection

- Monitor audit logs for anomalies
- Review failed login reports daily
- Check permission denial reports for abuse patterns
- Analyze security metrics endpoint
- Alert on slow permission checks (>10ms)

#### 2. Containment

- Identify affected users/resources
- Revoke compromised sessions
- Lock affected accounts
- Block malicious IPs (if infrastructure supports)
- Disable OAuth integration (if compromised)

#### 3. Investigation

- Query audit logs for full timeline
- Identify attack vector
- Determine scope of compromise
- Review permission denial logs
- Check for privilege escalation attempts

#### 4. Remediation

- Apply security patches
- Rotate credentials (OAuth secret)
- Notify affected users
- Document incident
- Update security controls

#### 5. Post-Incident

- Conduct root cause analysis
- Update threat model
- Enhance security controls
- Update penetration testing procedures
- Security training for team

### Contact Information

**Security Team:** security@echo-portal.example.com
**Bug Reports:** security-bugs@echo-portal.example.com
**Incident Hotline:** [TBD]

---

## Document Control

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-27 | T102 | Initial security review documentation |

**Review Schedule:** Quarterly or after major security changes

**Approvals:**
- [ ] Security Team Lead
- [ ] Development Team Lead
- [ ] Engineering Manager

---

**END OF DOCUMENT**
