import { useCallback, useState, useEffect } from 'react';
import { useAuth as useAuthContext } from '../context/AuthContext';

interface OAuthProviderHealth {
  provider: 'github' | 'google';
  available: boolean;
  state: 'healthy' | 'degraded' | 'unavailable';
  retryAfter?: number;
  message?: string;
}

interface OAuthHealthResponse {
  providers: Record<'github' | 'google', OAuthProviderHealth>;
  timestamp: string;
}

export function useAuth() {
  const authContext = useAuthContext();
  const [oauthHealth, setOAuthHealth] = useState<OAuthHealthResponse | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const loginWithProvider = useCallback((provider: 'github' | 'google') => {
    // Generate state for OAuth CSRF protection
    const state = generateRandomState();
    sessionStorage.setItem('oauth_state', state);

    // For Google, also generate code verifier for PKCE
    if (provider === 'google') {
      const codeVerifier = generateCodeVerifier();
      sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    }

    // Redirect to OAuth login
    window.location.href = `/api/v1/auth/login/${provider}`;
  }, []);

  const handleOAuthCallback = useCallback(async (code: string, state: string) => {
    // Verify state matches
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }

    // Get code verifier for Google PKCE
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

    try {
      // The backend will handle the callback and set the session cookie
      const params = new URLSearchParams({ code, state });
      if (codeVerifier) {
        params.append('codeVerifier', codeVerifier);
      }

      const response = await fetch(`/api/v1/auth/callback?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('OAuth callback failed');
      }

      // Clear stored state and verifier
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');

      // Refresh auth context
      await authContext.refreshSession();

      return true;
    } catch (error) {
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');
      throw error;
    }
  }, [authContext]);

  const getOAuthHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const response = await fetch('/api/v1/auth/health', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setOAuthHealth(data.data);
        return data.data as OAuthHealthResponse;
      }

      return null;
    } catch (error) {
      console.error('Failed to check OAuth health:', error);
      return null;
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  const logout = useCallback(
    async (allSessions = false) => {
      await authContext.logout(allSessions);
    },
    [authContext]
  );

  // Check OAuth health on mount
  useEffect(() => {
    getOAuthHealth();
  }, [getOAuthHealth]);

  return {
    ...authContext,
    loginWithProvider,
    handleOAuthCallback,
    getOAuthHealth,
    oauthHealth,
    isCheckingHealth,
    logout,
  };
}

/**
 * Generate a random state for OAuth CSRF protection
 */
function generateRandomState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a code verifier for PKCE (Google OAuth)
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Base64 URL encode (without padding)
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
