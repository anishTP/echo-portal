/**
 * Milkdown plugin for rendering video embeds.
 * Detects video URLs in image syntax and renders them as video players.
 */
import { useState, useCallback, useMemo } from 'react';
import { useNodeViewContext, useNodeViewFactory } from '@prosemirror-adapter/react';
import { imageSchema } from '@milkdown/preset-commonmark';
import { $view } from '@milkdown/utils';
import { detectVideoType, VideoEmbed } from './VideoEmbed';
import { MediaErrorPlaceholder, isValidUrl } from './MediaErrorPlaceholder';

/**
 * React component for rendering images or videos based on URL type.
 */
function MediaNodeView() {
  const { node } = useNodeViewContext();
  const src = node.attrs.src as string;
  const alt = node.attrs.alt as string;
  const title = node.attrs.title as string;
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const videoType = detectVideoType(src);

  // Handle image load error
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Handle retry for failed images
  const handleRetry = useCallback(() => {
    setImageError(false);
    setRetryCount((c) => c + 1);
  }, []);

  // If it's a video URL, render VideoEmbed
  if (videoType !== 'unknown') {
    return <VideoEmbed src={src} alt={alt} />;
  }

  // Show upload placeholder for empty src (newly dropped images)
  if (!src || src.trim() === '') {
    return (
      <ImageUploadPlaceholder
        alt={alt}
        title={title}
      />
    );
  }

  // Check if URL is valid before attempting to render
  if (!isValidUrl(src)) {
    return (
      <MediaErrorPlaceholder
        src={src}
        alt={alt}
        error="Invalid URL format"
        mediaType="image"
      />
    );
  }

  // Show error placeholder if image failed to load
  if (imageError) {
    return (
      <MediaErrorPlaceholder
        src={src}
        alt={alt}
        mediaType="image"
        onRetry={handleRetry}
      />
    );
  }

  // Render as a regular image with error handling
  return (
    <img
      key={`${src}-${retryCount}`}
      src={src}
      alt={alt}
      title={title || undefined}
      className="milkdown-image"
      onError={handleImageError}
    />
  );
}

/**
 * Placeholder shown when an image is dropped but needs a URL.
 */
function ImageUploadPlaceholder({ alt, title }: { alt?: string; title?: string }) {
  return (
    <div className="image-upload-placeholder">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <div className="image-upload-info">
        <strong>{alt || 'Image'}</strong>
        <span>Add image URL in markdown mode: ![{alt || 'alt'}](https://...)</span>
        {title && <span className="image-upload-hint">{title}</span>}
      </div>
    </div>
  );
}

/**
 * Hook to create the video embed view plugin for Milkdown.
 * Must be called inside a component that's wrapped with ProsemirrorAdapterProvider.
 */
export function useVideoEmbedView() {
  const nodeViewFactory = useNodeViewFactory();

  // Memoize the plugin to prevent infinite re-renders
  return useMemo(
    () =>
      $view(imageSchema.node, () =>
        nodeViewFactory({
          component: MediaNodeView,
        })
      ),
    [nodeViewFactory]
  );
}

export { MediaNodeView };
export default useVideoEmbedView;
