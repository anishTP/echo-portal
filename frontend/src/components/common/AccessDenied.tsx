import { Button, Callout } from '@radix-ui/themes';

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
      <div className="w-full max-w-md space-y-4">
        <Callout.Root color="red" size="3">
          <Callout.Icon>
            <svg
              className="h-6 w-6"
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
          </Callout.Icon>
          <Callout.Text>
            <strong className="text-lg">{message}</strong>
            {guidance && (
              <div className="mt-2 space-y-3">
                <p>{guidance.reason}</p>

                {showDetails && (
                  <div className="space-y-1 text-sm">
                    {guidance.requiredRole && (
                      <div>
                        <span className="font-medium">Required Role:</span>{' '}
                        <span className="capitalize">{guidance.requiredRole}</span>
                      </div>
                    )}
                    {guidance.requiredPermission && (
                      <div>
                        <span className="font-medium">Required Permission:</span>{' '}
                        <span className="capitalize">{guidance.requiredPermission}</span>
                      </div>
                    )}
                    {guidance.currentState && (
                      <div>
                        <span className="font-medium">Branch State:</span>{' '}
                        <span className="capitalize">{guidance.currentState}</span>
                      </div>
                    )}
                    {guidance.visibility && (
                      <div>
                        <span className="font-medium">Visibility:</span>{' '}
                        <span className="capitalize">{guidance.visibility}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Callout.Text>
        </Callout.Root>

        {guidance?.action && (
          <Callout.Root color="blue" size="2">
            <Callout.Icon>
              <svg
                className="h-5 w-5"
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
            </Callout.Icon>
            <Callout.Text>
              <strong>What you can do</strong>
              <p className="mt-1">{guidance.action}</p>
            </Callout.Text>
          </Callout.Root>
        )}

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
    <Callout.Root color="red" size="2">
      <Callout.Icon>
        <svg
          className="h-5 w-5"
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
      </Callout.Icon>
      <Callout.Text>
        <strong>{message}</strong>
        {guidance?.reason && <p className="mt-1">{guidance.reason}</p>}
        {guidance?.action && <p className="mt-1">{guidance.action}</p>}
      </Callout.Text>
    </Callout.Root>
  );
}

export default AccessDenied;
