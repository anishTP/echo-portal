import { Text } from '@radix-ui/themes';
import styles from './ContentRenderer.module.css';

const SECTION_LABELS: Record<string, string> = {
  brand: 'Brands',
  product: 'Products',
  experience: 'Experiences',
};

interface ContentBreadcrumbProps {
  section?: string | null;
  categoryName?: string | null;
  subcategoryName?: string | null;
  contentTitle: string;
}

export function ContentBreadcrumb({
  section,
  categoryName,
  subcategoryName,
  contentTitle,
}: ContentBreadcrumbProps) {
  const segments: string[] = [];

  if (section) {
    const label = SECTION_LABELS[section] || section;
    segments.push(label);
  }

  if (categoryName) {
    segments.push(categoryName);
  }

  if (subcategoryName) {
    segments.push(subcategoryName);
  }

  segments.push(contentTitle);

  // Don't render if only the title exists (no hierarchy context)
  if (segments.length <= 1) {
    return null;
  }

  return (
    <div className={styles.breadcrumb}>
      {segments.map((segment, i) => (
        <Text key={i} as="span" size="2">
          {i > 0 && (
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              ›
            </span>
          )}
          <span className={styles.breadcrumbSegment}>{segment}</span>
        </Text>
      ))}
    </div>
  );
}
