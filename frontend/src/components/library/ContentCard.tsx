import { Link } from 'react-router-dom';
import { Card, Badge, Text, Flex, Heading } from '@radix-ui/themes';
import type { ContentSummary } from '@echo-portal/shared';

interface ContentCardProps {
  content: ContentSummary;
}

const typeColors: Record<string, 'green' | 'purple' | 'amber' | 'gray'> = {
  guideline: 'green',
  asset: 'purple',
  opinion: 'amber',
};

export function ContentCard({ content }: ContentCardProps) {
  const publishedDate = content.publishedAt
    ? new Date(content.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Card asChild className="group transition-all hover:shadow-md">
      <Link to={`/library/${content.slug}`}>
        {/* Type Badge */}
        <Badge color={typeColors[content.contentType] || 'gray'} radius="full">
          {content.contentType.charAt(0).toUpperCase() + content.contentType.slice(1)}
        </Badge>

        {/* Title */}
        <Heading as="h3" size="4" className="mt-3 group-hover:text-[var(--accent-11)]">
          {content.title}
        </Heading>

        {/* Description */}
        {content.description && (
          <Text as="p" size="2" color="gray" className="mt-2 line-clamp-3">
            {content.description}
          </Text>
        )}

        {/* Metadata */}
        <Flex wrap="wrap" gap="3" mt="4" align="center">
          {content.category && (
            <Text size="1" color="gray" className="inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              {content.category}
            </Text>
          )}
          <Text size="1" color="gray" className="inline-flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {content.createdBy.displayName}
          </Text>
          {publishedDate && (
            <Text size="1" color="gray" className="inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {publishedDate}
            </Text>
          )}
        </Flex>

        {/* Tags */}
        {content.tags.length > 0 && (
          <Flex wrap="wrap" gap="1" mt="3">
            {content.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} color="gray" variant="soft" size="1">
                {tag}
              </Badge>
            ))}
            {content.tags.length > 3 && (
              <Badge color="gray" variant="soft" size="1">
                +{content.tags.length - 3}
              </Badge>
            )}
          </Flex>
        )}
      </Link>
    </Card>
  );
}

export default ContentCard;
