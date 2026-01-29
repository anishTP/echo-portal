import { Button } from '@radix-ui/themes';

interface AccessDeniedGuidance {
  reason: string;
  requiredRole?: string;
  requiredPermission?: string;
  currentState?: string;
  visibility?: string;
  action?: string;
}

interface AccessDeniedProps {
  message?: string;
  guidance?: AccessDeniedGuidance;
  showDetails?: boolean;
}

export function AccessDenied({
  message = 'Access Denied',
  guidance,
  showDetails = true,
}: AccessDeniedProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          {/* Icon */}
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-red-100 p-3">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Message */}
          <h2 className="mb-2 text-center text-xl font-semibold text-gray-900">
            {message}
          </h2>

          {guidance && (
            <div className="space-y-4">
              {/* Reason */}
              <p className="text-center text-sm text-gray-700">{guidance.reason}</p>

              {/* Details */}
              {showDetails && (
                <div className="space-y-2 rounded-md bg-white p-4">
                  {guidance.requiredRole && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-medium text-gray-700">Required Role:</span>
                      <span className="capitalize text-gray-600">{guidance.requiredRole}</span>
                    </div>
                  )}

                  {guidance.requiredPermission && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-medium text-gray-700">Required Permission:</span>
                      <span className="capitalize text-gray-600">
                        {guidance.requiredPermission}
                      </span>
                    </div>
                  )}

                  {guidance.currentState && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-medium text-gray-700">Branch State:</span>
                      <span className="capitalize text-gray-600">{guidance.currentState}</span>
                    </div>
                  )}

                  {guidance.visibility && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-medium text-gray-700">Visibility:</span>
                      <span className="capitalize text-gray-600">{guidance.visibility}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action */}
              {guidance.action && (
                <div className="rounded-md bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-blue-900">What you can do</h3>
                      <p className="mt-1 text-sm text-blue-700">{guidance.action}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Back button */}
          <div className="mt-6">
            <Button
              color="red"
              size="2"
              onClick={() => window.history.back()}
              style={{ width: '100%' }}
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline version of AccessDenied
 */
export function AccessDeniedInline({
  message = 'You do not have permission to view this content',
  guidance,
}: AccessDeniedProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-900">{message}</h3>
          {guidance?.reason && (
            <p className="mt-1 text-sm text-red-700">{guidance.reason}</p>
          )}
          {guidance?.action && (
            <p className="mt-2 text-sm text-red-600">{guidance.action}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccessDenied;
