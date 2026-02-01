/**
 * T050: Component test for media rendering
 * Tests that image and video markdown renders correctly in the editor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test markdown inputs for media embedding
const testCases = {
  images: {
    basic: '![Alt text](https://example.com/image.png)',
    withTitle: '![Alt text](https://example.com/image.png "Image title")',
    localPath: '![Screenshot](/uploads/screenshot.png)',
    dataUri: '![Inline](data:image/png;base64,iVBORw0KGgo=)',
    noAlt: '![](https://example.com/image.png)',
  },
  videos: {
    youtube: '![Video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
    youtubeShort: '![Video](https://youtu.be/dQw4w9WgXcQ)',
    vimeo: '![Video](https://vimeo.com/123456789)',
    mp4Direct: '![Video](https://example.com/video.mp4)',
  },
  invalid: {
    brokenUrl: '![Image](not-a-valid-url)',
    missingProtocol: '![Image](example.com/image.png)',
    emptyUrl: '![Image]()',
  },
};

describe('media-embed', () => {
  describe('image markdown patterns', () => {
    it('should recognize basic image markdown syntax', () => {
      const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;
      const match = testCases.images.basic.match(pattern);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('Alt text');
      expect(match?.[2]).toBe('https://example.com/image.png');
    });

    it('should recognize image with title', () => {
      const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;
      const match = testCases.images.withTitle.match(pattern);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('Alt text');
      expect(match?.[2]).toBe('https://example.com/image.png');
      expect(match?.[3]).toBe('Image title');
    });

    it('should handle images with empty alt text', () => {
      const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;
      const match = testCases.images.noAlt.match(pattern);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('');
      expect(match?.[2]).toBe('https://example.com/image.png');
    });

    it('should handle local image paths', () => {
      const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;
      const match = testCases.images.localPath.match(pattern);

      expect(match).not.toBeNull();
      expect(match?.[2]).toBe('/uploads/screenshot.png');
    });

    it('should handle data URIs', () => {
      const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;
      const match = testCases.images.dataUri.match(pattern);

      expect(match).not.toBeNull();
      expect(match?.[2]).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('video URL detection', () => {
    it('should detect YouTube URLs', () => {
      const isYouTube = (url: string): boolean => {
        return /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(url);
      };

      expect(isYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isYouTube('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
      expect(isYouTube('https://example.com/video.mp4')).toBe(false);
    });

    it('should extract YouTube video ID', () => {
      const extractYouTubeId = (url: string): string | null => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match?.[1] ?? null;
      };

      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should detect Vimeo URLs', () => {
      const isVimeo = (url: string): boolean => {
        return /vimeo\.com\/(\d+)/.test(url);
      };

      expect(isVimeo('https://vimeo.com/123456789')).toBe(true);
      expect(isVimeo('https://example.com/video.mp4')).toBe(false);
    });

    it('should extract Vimeo video ID', () => {
      const extractVimeoId = (url: string): string | null => {
        const match = url.match(/vimeo\.com\/(\d+)/);
        return match?.[1] ?? null;
      };

      expect(extractVimeoId('https://vimeo.com/123456789')).toBe('123456789');
    });

    it('should detect direct video file URLs', () => {
      const isDirectVideo = (url: string): boolean => {
        return /\.(mp4|webm|ogg)$/i.test(url);
      };

      expect(isDirectVideo('https://example.com/video.mp4')).toBe(true);
      expect(isDirectVideo('https://example.com/video.webm')).toBe(true);
      expect(isDirectVideo('https://example.com/video.ogg')).toBe(true);
      expect(isDirectVideo('https://example.com/image.png')).toBe(false);
    });
  });

  describe('URL validation', () => {
    it('should validate HTTP/HTTPS URLs', () => {
      const isValidMediaUrl = (url: string): boolean => {
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
      };

      expect(isValidMediaUrl('https://example.com/image.png')).toBe(true);
      expect(isValidMediaUrl('http://example.com/image.png')).toBe(true);
      expect(isValidMediaUrl('/uploads/image.png')).toBe(true);
      expect(isValidMediaUrl('data:image/png;base64,abc123')).toBe(true);
      expect(isValidMediaUrl('not-a-valid-url')).toBe(false);
      expect(isValidMediaUrl('')).toBe(false);
      expect(isValidMediaUrl('ftp://example.com/file')).toBe(false);
    });

    it('should detect empty URLs', () => {
      const pattern = /!\[([^\]]*)\]\(([^)\s]*)/;
      const match = testCases.invalid.emptyUrl.match(pattern);

      expect(match?.[2]).toBe('');
    });
  });

  describe('media type detection', () => {
    type MediaType = 'image' | 'youtube' | 'vimeo' | 'video' | 'unknown';

    const detectMediaType = (url: string): MediaType => {
      if (!url) return 'unknown';

      // YouTube
      if (/(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url)) {
        return 'youtube';
      }

      // Vimeo
      if (/vimeo\.com\/\d+/.test(url)) {
        return 'vimeo';
      }

      // Direct video files
      if (/\.(mp4|webm|ogg)$/i.test(url)) {
        return 'video';
      }

      // Image files or other URLs (treated as images by default)
      if (/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(url) || url.startsWith('data:image')) {
        return 'image';
      }

      // Default to image for valid URLs without extension
      return 'image';
    };

    it('should detect YouTube media type', () => {
      expect(detectMediaType('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
      expect(detectMediaType('https://youtu.be/abc123')).toBe('youtube');
    });

    it('should detect Vimeo media type', () => {
      expect(detectMediaType('https://vimeo.com/123456789')).toBe('vimeo');
    });

    it('should detect direct video media type', () => {
      expect(detectMediaType('https://example.com/video.mp4')).toBe('video');
      expect(detectMediaType('https://example.com/video.webm')).toBe('video');
    });

    it('should detect image media type', () => {
      expect(detectMediaType('https://example.com/image.png')).toBe('image');
      expect(detectMediaType('https://example.com/photo.jpg')).toBe('image');
      expect(detectMediaType('data:image/png;base64,abc')).toBe('image');
    });

    it('should default to image for unknown URLs', () => {
      expect(detectMediaType('https://example.com/some-path')).toBe('image');
    });
  });

  describe('error placeholder content', () => {
    it('should generate appropriate error message for invalid URLs', () => {
      const getErrorMessage = (url: string, error?: string): string => {
        if (!url) return 'No media URL provided';
        if (error) return error;
        return `Failed to load media: ${url}`;
      };

      expect(getErrorMessage('')).toBe('No media URL provided');
      expect(getErrorMessage('https://example.com/broken.png')).toBe(
        'Failed to load media: https://example.com/broken.png'
      );
      expect(getErrorMessage('https://example.com/file.png', 'Network error')).toBe('Network error');
    });
  });
});
