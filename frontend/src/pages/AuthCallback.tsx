import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const success = searchParams.get('success');
      const errorParam = searchParams.get('error');
      const errorMessage = searchParams.get('message');

      if (errorParam) {
        // Handle OAuth error
        let displayError = 'Authentication failed. Please try again.';

        if (errorParam === 'provider_unavailable') {
          displayError = decodeURIComponent(errorMessage || 'OAuth provider is temporarily unavailable. Please try again later.');
        } else if (errorParam === 'auth_failed') {
          displayError = 'Authentication failed. Please try again.';
        }

        setError(displayError);

        // Redirect to home after 3 seconds
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
        return;
      }

      if (success === 'true') {
        // Successful authentication - refresh session to get user data
        try {
          await refreshSession();
          // Redirect to dashboard
          navigate('/dashboard', { replace: true });
        } catch (err) {
          console.error('Failed to refresh session:', err);
          setError('Failed to complete authentication. Please try logging in again.');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 3000);
        }
      } else {
        // No success or error param - might be invalid callback
        setError('Invalid authentication callback.');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, refreshSession]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-4 flex justify-center">
            <svg
              className="h-12 w-12 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-center text-xl font-semibold text-gray-900">
            Authentication Error
          </h2>
          <p className="mb-4 text-center text-gray-600">{error}</p>
          <p className="text-center text-sm text-gray-500">
            Redirecting to home page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 inline-block">
          <svg
            className="h-12 w-12 animate-spin text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          Completing authentication...
        </h2>
        <p className="text-gray-600">Please wait while we sign you in.</p>
      </div>
    </div>
  );
}

export default AuthCallback;
