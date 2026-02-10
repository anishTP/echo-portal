import {
  COMPLIANCE_CATEGORIES,
  type ComplianceCategory,
  type ComplianceCategoryConfig,
} from '@echo-portal/shared';

const CATEGORY_INSTRUCTIONS: Record<ComplianceCategory, string> = {
  brand_adherence:
    'Evaluate logo usage, colour palette adherence, typography consistency, and layout conformance against organisational brand guidelines',
  accessibility:
    'Check alt-text quality, contrast ratios, text legibility within images, and whether decorative vs informational classification is appropriate',
  content_appropriateness:
    'Assess professional quality, relevance to surrounding content context, and absence of offensive or inappropriate imagery',
  licensing_attribution:
    'Check for watermarks, stock photo indicators, missing attribution, and rights metadata concerns',
  technical_quality:
    'Evaluate resolution adequacy for display, file size optimisation, and format appropriateness (e.g., SVG for diagrams, WebP for photos)',
};

/**
 * Build a compliance-specific system prompt from enabled categories,
 * their severity levels, and optional context documents (brand guidelines, etc.).
 *
 * Used when mode === 'analyse' and images are present.
 */
export function buildComplianceSystemPrompt(
  categories: Record<ComplianceCategory, ComplianceCategoryConfig>,
  contextDocuments?: Array<{ title: string; content: string }>,
): string {
  const enabledCategories = COMPLIANCE_CATEGORIES.filter((c) => categories[c]?.enabled);

  const categoryBlock = enabledCategories
    .map((cat) => {
      const config = categories[cat];
      const label = cat
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      return `- **${label}** (Severity: ${config.severity}): ${CATEGORY_INSTRUCTIONS[cat]}`;
    })
    .join('\n');

  const severities = enabledCategories
    .map((c) => categories[c].severity)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' or ');

  const refBlock = contextDocuments?.length
    ? `\n\n--- Reference Materials ---\n${contextDocuments.map((d) => `## ${d.title}\n${d.content}`).join('\n\n')}\n--- End Reference Materials ---`
    : '';

  return `You are an image compliance reviewer for a documentation portal. Analyse the provided image(s) against the following compliance categories:

${categoryBlock}

For each issue found, structure your response as:
- **Category**: The compliance category name
- **Severity**: ${severities}
- **Issue**: Clear description of the compliance concern
- **Remediation**: Specific action the author can take to resolve the issue

If multiple images are provided, clearly identify which image each finding relates to.

If the image passes all categories with no issues, confirm that the image is compliant.

You may use conversational language. If the user asks follow-up questions about specific findings, provide additional detail.${refBlock}`;
}
