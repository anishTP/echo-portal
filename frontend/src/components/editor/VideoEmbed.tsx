
export type VideoType = 'youtube' | 'vimeo' | 'direct' | 'unknown';

export interface VideoEmbedProps {
  src: string;
  alt?: string;
  className?: string;
}

/**
 * Detect the type of video from a URL.
 */
export function detectVideoType(url: string): VideoType {
  if (!url) return 'unknown';

  // YouTube
  if (/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url)) {
    return 'youtube';
  }

  // Vimeo
  if (/vimeo\.com\/(?:\d+|video\/\d+)/.test(url)) {
    return 'vimeo';
  }

  // Direct video files
  if (/\.(mp4|webm|ogg)$/i.test(url)) {
    return 'direct';
  }

  return 'unknown';
}

/**
 * Extract YouTube video ID from various URL formats.
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * Extract Vimeo video ID from URL.
 */
export function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? null;
}

/**
 * Get YouTube embed URL from video ID.
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Get Vimeo embed URL from video ID.
 */
export function getVimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}`;
}

/**
 * Video embed component that handles YouTube, Vimeo, and direct video URLs.
 * Renders the appropriate player based on the video source.
 */
export function VideoEmbed({ src, alt, className = '' }: VideoEmbedProps) {
  const videoType = detectVideoType(src);

  if (videoType === 'youtube') {
    const videoId = extractYouTubeId(src);
    if (!videoId) {
      return <VideoError src={src} message="Invalid YouTube URL" />;
    }

    return (
      <span className={`video-embed video-embed--youtube ${className}`}>
        <iframe
          src={getYouTubeEmbedUrl(videoId)}
          title={alt || 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        />
      </span>
    );
  }

  if (videoType === 'vimeo') {
    const videoId = extractVimeoId(src);
    if (!videoId) {
      return <VideoError src={src} message="Invalid Vimeo URL" />;
    }

    return (
      <span className={`video-embed video-embed--vimeo ${className}`}>
        <iframe
          src={getVimeoEmbedUrl(videoId)}
          title={alt || 'Vimeo video'}
          allow="autoplay; fullscreen; picture-in-picture"
        />
      </span>
    );
  }

  if (videoType === 'direct') {
    return (
      <span className={`video-embed video-embed--direct ${className}`}>
        <video controls preload="metadata">
          <source src={src} type={getVideoMimeType(src)} />
          {alt && <track kind="captions" label={alt} />}
          Your browser does not support the video tag.
        </video>
      </span>
    );
  }

  // Unknown video type - show error
  return <VideoError src={src} message="Unsupported video format" />;
}

/**
 * Get MIME type for video file extension.
 */
function getVideoMimeType(url: string): string {
  if (url.endsWith('.mp4')) return 'video/mp4';
  if (url.endsWith('.webm')) return 'video/webm';
  if (url.endsWith('.ogg')) return 'video/ogg';
  return 'video/mp4';
}

interface VideoErrorProps {
  src: string;
  message: string;
}

function VideoError({ src, message }: VideoErrorProps) {
  return (
    <span className="video-embed video-embed--error">
      <span className="video-error-content">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <span>{message}</span>
        <code>{src}</code>
      </span>
    </span>
  );
}

export default VideoEmbed;
