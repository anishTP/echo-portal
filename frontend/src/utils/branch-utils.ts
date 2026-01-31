/**
 * Generate a suggested branch name for editing published content.
 * Format: edit-{content-slug}-{short-timestamp}
 */
export function suggestBranchName(contentSlug: string): string {
  const timestamp = Date.now().toString(36);
  const sanitizedSlug = contentSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  return `edit-${sanitizedSlug}-${timestamp}`;
}

/**
 * Generate a human-readable branch name for editing.
 * Format: "Edit: {Content Title}"
 */
export function suggestBranchDisplayName(contentTitle: string): string {
  const truncatedTitle = contentTitle.length > 80
    ? contentTitle.slice(0, 77) + '...'
    : contentTitle;
  return `Edit: ${truncatedTitle}`;
}

/**
 * Validate a branch slug.
 * Must be lowercase alphanumeric with hyphens only.
 */
export function isValidBranchSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 1 && slug.length <= 100;
}
