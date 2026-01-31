/**
 * Extract clean GFM markdown from editor content.
 * Ensures output is portable and contains no proprietary markup.
 */
export function cleanMarkdown(markdown: string): string {
  return markdown
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Remove any data attributes that might have leaked
    .replace(/\s*data-[a-z-]+="[^"]*"/gi, '')
    // Ensure consistent trailing newline
    .replace(/\n*$/, '\n');
}

/**
 * Validate markdown output for GFM compliance.
 * Returns issues found, empty array if valid.
 */
export function validateMarkdownOutput(markdown: string): string[] {
  const issues: string[] = [];

  // Check for HTML tags (except allowed ones like <br>)
  if (/<(?!br\s*\/?>)[a-z]/i.test(markdown)) {
    issues.push('Contains disallowed HTML tags');
  }

  // Check for data attributes
  if (/data-\w+=/i.test(markdown)) {
    issues.push('Contains data attributes');
  }

  return issues;
}

/**
 * Extract headings from markdown for table of contents.
 */
export function extractHeadings(markdown: string): Array<{ level: number; text: string; id: string }> {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Array<{ level: number; text: string; id: string }> = [];

  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    headings.push({ level, text, id });
  }

  return headings;
}
