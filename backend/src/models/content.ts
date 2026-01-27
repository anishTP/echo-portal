import { createHash } from 'crypto';

/**
 * Generate a URL-safe slug from a content title.
 * Slugs are unique per branch (enforced by DB constraint).
 */
export function generateContentSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

/**
 * Compute SHA-256 checksum of content body.
 */
export function computeChecksum(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/**
 * Compute byte size of content body.
 */
export function computeByteSize(body: string): number {
  return Buffer.byteLength(body, 'utf8');
}

/**
 * Create a metadata snapshot from content fields.
 * Frozen into each version for audit purposes.
 */
export function createMetadataSnapshot(fields: {
  title: string;
  category?: string | null;
  tags: string[];
}): { title: string; category?: string; tags: string[] } {
  return {
    title: fields.title,
    ...(fields.category ? { category: fields.category } : {}),
    tags: [...fields.tags],
  };
}

/**
 * Max content body size in bytes (50 MB)
 */
export const MAX_CONTENT_BYTE_SIZE = 52_428_800;
