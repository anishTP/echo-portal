import { Link } from 'react-router-dom';
import { Text } from '@radix-ui/themes';
import styles from './ContentRenderer.module.css';

const SECTION_LABELS: Record<string, string> = {
  brand: 'Brands',
  product: 'Products',
  experience: 'Experiences',
};

// Map singular DB section value to plural URL param
const SECTION_URL_PARAMS: Record<string, string> = {
  brand: 'brands',
  product: 'products',
  experience: 'experiences',
};

interface ContentBreadcrumbProps {
  section?: string | null;
  categoryName?: string | null;
  subcategoryName?: string | null;
  subcategoryId?: string | null;
  contentTitle: string;
}

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function ContentBreadcrumb({
  section,
  categoryName,
  subcategoryName,
  subcategoryId,
  contentTitle,
}: ContentBreadcrumbProps) {
  const segments: BreadcrumbSegment[] = [];
  const sectionUrlParam = section ? (SECTION_URL_PARAMS[section] || section) : null;

  if (section) {
    const label = SECTION_LABELS[section] || section;
    segments.push({
      label,
      href: sectionUrlParam ? `/library?section=${sectionUrlParam}` : undefined,
    });
  }

  if (categoryName) {
    segments.push({
      label: categoryName,
      href: sectionUrlParam
        ? `/library?section=${sectionUrlParam}&category=${encodeURIComponent(categoryName)}`
        : undefined,
    });
  }

  if (subcategoryName) {
    segments.push({
      label: subcategoryName,
      href: sectionUrlParam && categoryName && subcategoryId
        ? `/library?section=${sectionUrlParam}&category=${encodeURIComponent(categoryName)}&subcategoryId=${subcategoryId}`
        : undefined,
    });
  }

  // Current page (last segment) — not a link
  segments.push({ label: contentTitle });

  // Don't render if only the title exists (no hierarchy context)
  if (segments.length <= 1) {
    return null;
  }

  return (
    <div className={styles.breadcrumb}>
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <Text key={i} as="span" size="2">
            {i > 0 && (
              <span className={styles.breadcrumbSeparator} aria-hidden="true">
                ›
              </span>
            )}
            {!isLast && segment.href ? (
              <Link to={segment.href} className={styles.breadcrumbLink}>
                {segment.label}
              </Link>
            ) : (
              <span className={styles.breadcrumbSegment}>{segment.label}</span>
            )}
          </Text>
        );
      })}
    </div>
  );
}
