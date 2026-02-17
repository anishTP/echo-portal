import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, LayersIcon } from '@radix-ui/react-icons';
import styles from './ContentMetadataSidebar.module.css';

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export interface ContentMetadataSidebarProps {
  /** Author information */
  author?: {
    name: string;
    avatarUrl?: string;
  };
  /** Published date string */
  publishedDate?: string;
  /** Content category */
  category?: string;
  /** Content tags */
  tags?: string[];
  /** Markdown content for TOC extraction */
  markdown?: string;
  /** Pre-computed TOC headings (alternative to markdown) */
  headings?: TocHeading[];
}

/**
 * Extract headings from markdown for TOC
 */
function extractHeadings(markdown: string): TocHeading[] {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const headings: TocHeading[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2]
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[(.+?)\]\(.*?\)/g, '$1')
      .trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    headings.push({ id, text, level });
  }

  return headings;
}

/**
 * Right sidebar component for content pages
 *
 * Displays:
 * - Author info with avatar
 * - Published date
 * - Category (with link)
 * - Tags
 * - Table of Contents (extracted from markdown)
 */
export function ContentMetadataSidebar({
  author,
  publishedDate,
  category,
  tags,
  markdown,
  headings: providedHeadings,
}: ContentMetadataSidebarProps) {
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  // Extract or use provided headings
  const headings = useMemo(() => {
    if (providedHeadings) return providedHeadings;
    if (markdown) return extractHeadings(markdown);
    return [];
  }, [markdown, providedHeadings]);

  // Track active heading based on scroll position
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id);
          }
        });
      },
      { rootMargin: '-64px 0px -80% 0px' }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  const hasMetadata = author || publishedDate || category || (tags && tags.length > 0);

  if (!hasMetadata && headings.length === 0) {
    return null;
  }

  return (
    <div className={styles.sidebar}>
      {/* Author */}
      {author && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Author</h3>
          <div className={styles.authorRow}>
            <div className={styles.avatar}>
              {author.avatarUrl ? (
                <img src={author.avatarUrl} alt={author.name} />
              ) : (
                author.name.charAt(0).toUpperCase()
              )}
            </div>
            <span className={styles.authorName}>{author.name}</span>
          </div>
        </div>
      )}

      {/* Metadata */}
      {(publishedDate || category) && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Details</h3>

          {publishedDate && (
            <div className={styles.metaItem}>
              <CalendarIcon className={styles.metaIcon} width={14} height={14} />
              <span>{publishedDate}</span>
            </div>
          )}

          {category && (
            <div className={styles.metaItem}>
              <LayersIcon className={styles.metaIcon} width={14} height={14} />
              <Link
                to={`/?category=${encodeURIComponent(category)}`}
                className={styles.metaLink}
              >
                {category}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Tags</h3>
          <div className={styles.tagList}>
            {tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table of Contents */}
      {headings.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>On this page</h3>
          <ul className={styles.tocList}>
            {headings.map((heading) => (
              <li key={heading.id} className={styles.tocItem}>
                <a
                  href={`#${heading.id}`}
                  className={styles.tocLink}
                  data-level={heading.level}
                  data-active={activeHeadingId === heading.id}
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById(heading.id);
                    if (element) {
                      const top = element.offsetTop - 80;
                      window.scrollTo({ top, behavior: 'smooth' });
                    }
                  }}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ContentMetadataSidebar;
