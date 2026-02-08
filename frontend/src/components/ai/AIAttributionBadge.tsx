import React from 'react';
import { Badge, Tooltip } from '@radix-ui/themes';

interface AIAttributionBadgeProps {
  /** AI provider identifier */
  providerId?: string;
  /** AI model identifier */
  modelId?: string;
  /** Name of the human who approved the AI content */
  approverName?: string;
  /** When the content was generated */
  generatedAt?: string;
  /** Compact mode (just the badge, no tooltip) */
  compact?: boolean;
}

/**
 * AIAttributionBadge — "AI Generated" badge for review interfaces (FR-006)
 *
 * Shows on content versions where authorType='system'. Hover reveals
 * provider/model details, approver name, and generation timestamp.
 */
export function AIAttributionBadge({
  providerId,
  modelId,
  approverName,
  generatedAt,
  compact = false,
}: AIAttributionBadgeProps) {
  const badge = (
    <Badge color="purple" variant="soft" size="1">
      AI Generated
    </Badge>
  );

  if (compact || (!providerId && !approverName)) {
    return badge;
  }

  const tooltipLines: string[] = [];
  if (providerId) tooltipLines.push(`Provider: ${providerId}`);
  if (modelId) tooltipLines.push(`Model: ${modelId}`);
  if (approverName) tooltipLines.push(`Approved by: ${approverName}`);
  if (generatedAt) {
    tooltipLines.push(`Generated: ${new Date(generatedAt).toLocaleString()}`);
  }

  return (
    <Tooltip content={tooltipLines.join('\n')}>
      {badge}
    </Tooltip>
  );
}
