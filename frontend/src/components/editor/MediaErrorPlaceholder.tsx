/**
 * MediaErrorPlaceholder component for displaying error states when media fails to load.
 * Used by the InlineEditor for images and videos with invalid or broken URLs.
 */

export type MediaErrorType = 'image' | 'video' | 'unknown';

export interface MediaErrorPlaceholderProps {
  src: string;
  alt?: string;
  error?: string;
  mediaType?: MediaErrorType;
  className?: string;
  onRetry?: () => void;
}

/**
 * Get user-friendly error message based on the error type.
 */
export function getErrorMessage(
  src: string,
  error?: string,
  mediaType?: MediaErrorType
): string {
  if (error) return error;
  if (!src) return 'No media URL provided';
  if (!isValidUrl(src)) return 'Invalid URL format';

  const typeLabel = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'video' : 'media';
  return `Failed to load ${typeLabel}`;
}

/**
 * Check if a URL is valid (basic validation).
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  // Allow relative paths starting with /
  if (url.startsWith('/')) return true;
  // Allow data URIs
  if (url.startsWith('data:')) return true;
  // Check for valid HTTP(S) URL
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Icon component for the error placeholder.
 */
function ErrorIcon({ mediaType }: { mediaType?: MediaErrorType }) {
  if (mediaType === 'video') {
    return (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }

  // Default to image icon
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/**
 * Placeholder component displayed when media fails to load.
 * Shows an error icon, message, and the original URL.
 */
export function MediaErrorPlaceholder({
  src,
  alt,
  error,
  mediaType = 'unknown',
  className = '',
  onRetry,
}: MediaErrorPlaceholderProps) {
  const message = getErrorMessage(src, error, mediaType);

  return (
    <div
      className={`media-error-placeholder ${className}`}
      role="img"
      aria-label={alt || message}
    >
      <div className="media-error-content">
        <ErrorIcon mediaType={mediaType} />
        <span className="media-error-message">{message}</span>
        {src && <code className="media-error-url">{truncateUrl(src, 60)}</code>}
        {onRetry && (
          <button
            type="button"
            className="media-error-retry"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Truncate a URL for display, keeping the beginning and end visible.
 */
function truncateUrl(url: string, maxLength: number): string {
  if (url.length <= maxLength) return url;

  const ellipsis = '...';
  const partLength = Math.floor((maxLength - ellipsis.length) / 2);
  return url.slice(0, partLength) + ellipsis + url.slice(-partLength);
}

export default MediaErrorPlaceholder;
