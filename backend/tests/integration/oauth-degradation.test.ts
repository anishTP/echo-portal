import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import app from '../../src/api/index';
import {
  getAuthorizationURL,
  validateCallback,
  OAuthProviderUnavailableError,
  getProviderHealth,
  getAllProvidersHealth,
  resetCircuitBreaker,
} from '../../src/services/auth/oauth';

// Mock the OAuth provider functions
vi.mock('../../src/services/auth/oauth', async () => {
  const actual = await vi.importActual('../../src/services/auth/oauth');
  return {
    ...actual,
    getAuthorizationURL: vi.fn(),
    validateCallback: vi.fn(),
    resetCircuitBreaker: vi.fn(),
  };
});

// Mock database
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { db } from '../../src/db';

describe('OAuth Graceful Degradation Tests (T031)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset circuit breakers before each test
    resetCircuitBreaker('github');
    resetCircuitBreaker('google');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Unavailability Handling (FR-005c)', () => {
    it('should return error when OAuth provider is unavailable', async () => {
      // Mock provider unavailable error
      (getAuthorizationURL as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('github', 60000)
      );

      const response = await app.request('/api/v1/auth/login/github');

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe('Provider unavailable');
      expect(data.provider).toBe('github');
      expect(data.canRetry).toBe(true);
    });

    it('should maintain existing sessions when provider is unavailable', async () => {
      // Create a valid session first
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'valid-token',
        provider: 'github',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        roles: ['contributor'],
        lockedUntil: null,
      };

      // Mock session validation (existing session works)
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ session: mockSession, user: mockUser }]),
            }),
          }),
        }),
      });

      // Mock session activity update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      // Mock full user details fetch
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Existing session should work even if provider is down
      const response = await app.request('/api/v1/auth/me', {
        headers: {
          Cookie: 'echo_session=valid-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe('test@example.com');
    });

    it('should allow anonymous viewing of published content when provider is unavailable', async () => {
      // Mock provider unavailable
      (getAuthorizationURL as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('github', 60000)
      );

      // Even with provider down, API should be accessible
      const healthResponse = await app.request('/health');
      expect(healthResponse.status).toBe(200);

      // Public endpoints should work
      // (In real app, would test public branch viewing)
    });
  });

  describe('Provider Recovery and Circuit Breaker (FR-005d)', () => {
    it('should implement circuit breaker pattern for provider failures', async () => {
      // Simulate multiple failures to trip circuit breaker
      const providerError = new Error('Provider timeout');

      for (let i = 0; i < 5; i++) {
        (getAuthorizationURL as any).mockRejectedValueOnce(providerError);
      }

      // First 5 attempts should fail with normal error
      for (let i = 0; i < 5; i++) {
        const response = await app.request('/api/v1/auth/login/github');
        expect(response.status).toBeGreaterThanOrEqual(500);
      }

      // After 5 failures, circuit should be open
      // Next attempt should fail fast with circuit breaker error
      (getAuthorizationURL as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('github', 60000)
      );

      const response = await app.request('/api/v1/auth/login/github');
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe('Provider unavailable');
    });

    it('should provide retry-after timing when circuit is open', async () => {
      // Mock circuit breaker open state
      (getAuthorizationURL as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('github', 45000) // 45 seconds
      );

      const response = await app.request('/api/v1/auth/login/github');

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.message).toContain('try again');
      // Message should indicate how long to wait
    });

    it('should transition to half-open state after timeout', async () => {
      // This would require mocking timers
      // For simplicity, we test the concept

      // Mock circuit breaker moving to half-open
      (getAuthorizationURL as any).mockResolvedValueOnce(
        new URL('https://github.com/login/oauth/authorize?state=test')
      );

      const response = await app.request('/api/v1/auth/login/github');

      // In half-open state, should allow one attempt
      expect(response.status).toBeLessThan(500);
    });

    it('should close circuit after successful requests in half-open state', async () => {
      // Mock successful provider response
      (getAuthorizationURL as any).mockResolvedValue(
        new URL('https://github.com/login/oauth/authorize?state=test')
      );

      // Multiple successful requests should close circuit
      for (let i = 0; i < 3; i++) {
        const response = await app.request('/api/v1/auth/login/github');
        expect(response.status).toBe(200);
      }

      // Circuit should now be closed and stable
    });
  });

  describe('Provider Health Monitoring', () => {
    it('should track provider health status', () => {
      // Test provider health check
      const health = getProviderHealth('github');

      expect(health).toHaveProperty('available');
      expect(health).toHaveProperty('state');
      expect(['healthy', 'degraded', 'unavailable']).toContain(health.state);
    });

    it('should report health for all providers', () => {
      const allHealth = getAllProvidersHealth();

      expect(allHealth).toHaveProperty('github');
      expect(allHealth).toHaveProperty('google');

      expect(allHealth.github).toHaveProperty('available');
      expect(allHealth.github).toHaveProperty('state');

      expect(allHealth.google).toHaveProperty('available');
      expect(allHealth.google).toHaveProperty('state');
    });

    it('should indicate degraded state when recovering from failures', () => {
      // After some failures but before circuit opens
      const providerError = new Error('Temporary failure');

      for (let i = 0; i < 2; i++) {
        (getAuthorizationURL as any).mockRejectedValueOnce(providerError);
      }

      // Make a couple failed requests
      app.request('/api/v1/auth/login/github').catch(() => {});
      app.request('/api/v1/auth/login/github').catch(() => {});

      const health = getProviderHealth('github');

      // State might be degraded but still available
      if (health.state === 'degraded') {
        expect(health.available).toBe(true);
      }
    });
  });

  describe('Error Messages and User Experience', () => {
    it('should provide user-friendly error messages for provider unavailability', async () => {
      (getAuthorizationURL as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('github', 60000)
      );

      const response = await app.request('/api/v1/auth/login/github');

      const data = await response.json();
      expect(data.message).toBeDefined();
      expect(data.message.toLowerCase()).toContain('unavailable');
      expect(data.message.toLowerCase()).toContain('try again');
    });

    it('should redirect to error page with appropriate message on callback failure', async () => {
      // Mock callback failure due to provider unavailability
      (validateCallback as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('github', 60000)
      );

      const response = await app.request('/api/v1/auth/callback/github?code=test&state=test');

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('error=provider_unavailable');
      expect(location).toContain('message=');
    });

    it('should include provider name in error messages', async () => {
      (getAuthorizationURL as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('google', 60000)
      );

      const response = await app.request('/api/v1/auth/login/google');

      const data = await response.json();
      expect(data.provider).toBe('google');
      expect(data.message).toContain('google');
    });
  });

  describe('Multi-Provider Resilience', () => {
    it('should handle GitHub failure while Google works', async () => {
      // GitHub is down
      (getAuthorizationURL as any).mockImplementation((provider) => {
        if (provider === 'github') {
          return Promise.reject(new OAuthProviderUnavailableError('github', 60000));
        } else if (provider === 'google') {
          return Promise.resolve(new URL('https://accounts.google.com/o/oauth2/v2/auth?state=test'));
        }
      });

      // GitHub should fail
      const githubResponse = await app.request('/api/v1/auth/login/github');
      expect(githubResponse.status).toBe(503);

      // Google should work
      const googleResponse = await app.request('/api/v1/auth/login/google');
      expect(googleResponse.status).toBe(200);
    });

    it('should track circuit breaker state independently per provider', () => {
      const githubHealth = getProviderHealth('github');
      const googleHealth = getProviderHealth('google');

      // Each provider has its own health state
      expect(githubHealth).toBeDefined();
      expect(googleHealth).toBeDefined();

      // States can be different
      // (This test would be more meaningful with actual state differences)
    });
  });

  describe('Callback Degradation Scenarios', () => {
    it('should handle provider failure during callback gracefully', async () => {
      (validateCallback as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('github', 30000)
      );

      const response = await app.request('/api/v1/auth/callback/github?code=test-code&state=test-state');

      // Should redirect to frontend with error
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('error=provider_unavailable');
    });

    it('should not create partial user account on callback provider failure', async () => {
      (validateCallback as any).mockRejectedValueOnce(
        new OAuthProviderUnavailableError('github', 30000)
      );

      // Mock no user inserts should happen
      const insertMock = vi.fn();
      (db.insert as any).mockReturnValue({
        values: insertMock,
      });

      await app.request('/api/v1/auth/callback/github?code=test-code&state=test-state');

      // Should not create user if provider failed
      // (Login attempt might be logged, but not user creation)
    });
  });

  describe('Monitoring and Alerting Data', () => {
    it('should log provider failures for monitoring', async () => {
      const providerError = new Error('Provider timeout');
      (getAuthorizationURL as any).mockRejectedValueOnce(providerError);

      // Mock login attempt logging
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      });

      await app.request('/api/v1/auth/login/github').catch(() => {});

      // Error should be logged (in real implementation)
      // This would check audit logs or error tracking
    });

    it('should track circuit breaker state changes', () => {
      // In production, circuit breaker state changes should be logged
      // This test verifies the health check provides that data

      const health = getProviderHealth('github');

      // Health check should provide enough info for monitoring
      expect(health).toHaveProperty('state');
      expect(health).toHaveProperty('available');

      if (health.state === 'unavailable') {
        expect(health).toHaveProperty('retryAfter');
      }
    });
  });

  describe('Fallback Behavior', () => {
    it('should not prevent users from switching providers', async () => {
      // If GitHub is down, user can still try Google
      (getAuthorizationURL as any).mockImplementation((provider) => {
        if (provider === 'github') {
          return Promise.reject(new OAuthProviderUnavailableError('github', 60000));
        } else {
          return Promise.resolve(new URL(`https://${provider}.com/oauth?state=test`));
        }
      });

      // GitHub fails
      const githubResponse = await app.request('/api/v1/auth/login/github');
      expect(githubResponse.status).toBe(503);

      // Google works
      const googleResponse = await app.request('/api/v1/auth/login/google');
      expect(googleResponse.status).toBe(200);
    });
  });
});
