import { getGitHubAuthorizationURL, validateGitHubCallback } from './providers/github';
import { getGoogleAuthorizationURL, validateGoogleCallback } from './providers/google';
import type { OAuthUserInfo } from './config';

export type OAuthProvider = 'github' | 'google';

/**
 * Circuit breaker for OAuth provider health
 */
interface CircuitBreaker {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers = new Map<OAuthProvider, CircuitBreaker>();
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
const CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT = 30000; // 30 seconds

/**
 * Initialize circuit breaker for provider
 */
function getCircuitBreaker(provider: OAuthProvider): CircuitBreaker {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
    });
  }
  return circuitBreakers.get(provider)!;
}

/**
 * Check if circuit breaker allows request
 */
function canAttemptRequest(provider: OAuthProvider): boolean {
  const breaker = getCircuitBreaker(provider);
  const now = Date.now();

  if (breaker.state === 'closed') {
    return true;
  }

  if (breaker.state === 'open') {
    if (now - breaker.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      breaker.state = 'half-open';
      return true;
    }
    return false;
  }

  // half-open state
  if (now - breaker.lastFailure > CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT) {
    return true;
  }

  return false;
}

/**
 * Record successful request
 */
function recordSuccess(provider: OAuthProvider): void {
  const breaker = getCircuitBreaker(provider);
  breaker.failures = 0;
  breaker.state = 'closed';
}

/**
 * Record failed request
 */
function recordFailure(provider: OAuthProvider): void {
  const breaker = getCircuitBreaker(provider);
  breaker.failures += 1;
  breaker.lastFailure = Date.now();

  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    breaker.state = 'open';
  }
}

/**
 * OAuth provider unavailable error
 */
export class OAuthProviderUnavailableError extends Error {
  constructor(
    public provider: OAuthProvider,
    public retryAfter: number
  ) {
    super(
      `OAuth provider ${provider} is temporarily unavailable. Please try again in ${Math.ceil(retryAfter / 1000)} seconds.`
    );
    this.name = 'OAuthProviderUnavailableError';
  }
}

/**
 * Get authorization URL for OAuth provider with circuit breaker
 */
export async function getAuthorizationURL(
  provider: OAuthProvider,
  state: string,
  codeVerifier?: string
): Promise<URL> {
  if (!canAttemptRequest(provider)) {
    const breaker = getCircuitBreaker(provider);
    const retryAfter = CIRCUIT_BREAKER_TIMEOUT - (Date.now() - breaker.lastFailure);
    throw new OAuthProviderUnavailableError(provider, retryAfter);
  }

  try {
    let url: URL;
    switch (provider) {
      case 'github':
        url = await getGitHubAuthorizationURL(state);
        break;
      case 'google':
        if (!codeVerifier) {
          throw new Error('Google OAuth requires code verifier');
        }
        url = await getGoogleAuthorizationURL(state, codeVerifier);
        break;
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
    recordSuccess(provider);
    return url;
  } catch (error) {
    recordFailure(provider);
    throw error;
  }
}

/**
 * Validate OAuth callback with circuit breaker
 */
export async function validateCallback(
  provider: OAuthProvider,
  code: string,
  codeVerifier?: string
): Promise<OAuthUserInfo> {
  if (!canAttemptRequest(provider)) {
    const breaker = getCircuitBreaker(provider);
    const retryAfter = CIRCUIT_BREAKER_TIMEOUT - (Date.now() - breaker.lastFailure);
    throw new OAuthProviderUnavailableError(provider, retryAfter);
  }

  try {
    let userInfo: OAuthUserInfo;
    switch (provider) {
      case 'github':
        userInfo = await validateGitHubCallback(code);
        break;
      case 'google':
        if (!codeVerifier) {
          throw new Error('Google OAuth requires code verifier');
        }
        userInfo = await validateGoogleCallback(code, codeVerifier);
        break;
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
    recordSuccess(provider);
    return userInfo;
  } catch (error) {
    recordFailure(provider);
    throw error;
  }
}

/**
 * Check provider health status
 */
export function getProviderHealth(provider: OAuthProvider): {
  available: boolean;
  state: 'healthy' | 'degraded' | 'unavailable';
  retryAfter?: number;
} {
  const breaker = getCircuitBreaker(provider);

  if (breaker.state === 'closed') {
    return { available: true, state: 'healthy' };
  }

  if (breaker.state === 'half-open') {
    return { available: true, state: 'degraded' };
  }

  const retryAfter = CIRCUIT_BREAKER_TIMEOUT - (Date.now() - breaker.lastFailure);
  return {
    available: false,
    state: 'unavailable',
    retryAfter: Math.max(0, retryAfter),
  };
}

/**
 * Get health status for all providers
 */
export function getAllProvidersHealth(): Record<
  OAuthProvider,
  ReturnType<typeof getProviderHealth>
> {
  return {
    github: getProviderHealth('github'),
    google: getProviderHealth('google'),
  };
}

/**
 * Reset circuit breaker (for testing or manual recovery)
 */
export function resetCircuitBreaker(provider: OAuthProvider): void {
  circuitBreakers.delete(provider);
}
