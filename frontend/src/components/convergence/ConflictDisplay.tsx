interface ConflictDetail {
  path: string;
  type: 'content' | 'rename' | 'delete';
  description: string;
}

interface ValidationResult {
  check: string;
  passed: boolean;
  message?: string;
}

interface ConflictDisplayProps {
  conflicts: ConflictDetail[];
  validationResults?: ValidationResult[];
}

const conflictTypeConfig: Record<
  ConflictDetail['type'],
  { icon: string; color: string; label: string }
> = {
  content: {
    icon: '≠',
    color: 'text-orange-600',
    label: 'Content Conflict',
  },
  rename: {
    icon: '↔',
    color: 'text-blue-600',
    label: 'Rename Conflict',
  },
  delete: {
    icon: '⊘',
    color: 'text-red-600',
    label: 'Delete Conflict',
  },
};

export function ConflictDisplay({
  conflicts,
  validationResults,
}: ConflictDisplayProps) {
  const hasConflicts = conflicts.length > 0;
  const failedValidations = validationResults?.filter((r) => !r.passed) || [];

  if (!hasConflicts && failedValidations.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium text-green-800">
            No conflicts detected
          </span>
        </div>
        <p className="mt-1 text-sm text-green-700">
          This branch can be merged cleanly into main.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Validation Failures */}
      {failedValidations.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h4 className="flex items-center gap-2 font-medium text-yellow-800">
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Validation Issues ({failedValidations.length})
          </h4>
          <ul className="mt-2 space-y-1">
            {failedValidations.map((result, index) => (
              <li key={index} className="text-sm text-yellow-700">
                <span className="font-medium">{result.check}:</span>{' '}
                {result.message || 'Validation failed'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conflicts */}
      {hasConflicts && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h4 className="flex items-center gap-2 font-medium text-red-800">
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Merge Conflicts ({conflicts.length})
          </h4>
          <p className="mt-1 text-sm text-red-700">
            These conflicts must be resolved before the branch can be published.
          </p>

          <ul className="mt-3 space-y-2">
            {conflicts.map((conflict, index) => {
              const config = conflictTypeConfig[conflict.type];
              return (
                <li
                  key={index}
                  className="rounded-md bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${config.color}`}>
                      {config.icon}
                    </span>
                    <span className="font-mono text-sm font-medium text-gray-900">
                      {conflict.path}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${config.color} bg-opacity-10`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {conflict.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ConflictSummary({ conflictCount }: { conflictCount: number }) {
  if (conflictCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-green-600">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        No conflicts
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm text-red-600">
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
    </span>
  );
}

export default ConflictDisplay;
