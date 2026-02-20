import Markdown from 'react-markdown';
import { Button } from '@radix-ui/themes';
import { Pencil1Icon } from '@radix-ui/react-icons';
import type { CategoryDTO } from '../../services/category-api';
import type { CardData, CategoryCardData } from './LandingPageCardGrid';
import { LandingPageCardGrid } from './LandingPageCardGrid';
import { ContentBreadcrumb } from './ContentBreadcrumb';
import styles from './SectionLandingPage.module.css';

const SECTION_LABELS: Record<string, string> = {
  brand: 'Brands',
  product: 'Products',
  experience: 'Experiences',
};

export interface SectionLandingPageProps {
  section: string;
  categories: CategoryDTO[];
  categoryCounts: Record<string, number>;
  body: string;
  onEditRequest?: () => void;
  canEdit: boolean;
  branchMode?: boolean;
  onCardClick: (card: CardData) => void;
  isLoading?: boolean;
}

export function SectionLandingPage({
  section,
  categories,
  categoryCounts,
  body,
  onEditRequest,
  canEdit,
  branchMode,
  onCardClick,
  isLoading,
}: SectionLandingPageProps) {
  const sectionLabel = SECTION_LABELS[section] || section;
  const hasBody = body.trim().length > 0;

  const cards: CategoryCardData[] = categories.map((cat) => ({
    type: 'category' as const,
    id: cat.id,
    name: cat.name,
    contentCount: categoryCounts[cat.name] ?? 0,
  }));

  return (
    <article className={styles.page} aria-label={`${sectionLabel} section landing page`}>
      <nav aria-label="Breadcrumb">
        <ContentBreadcrumb
          section={section}
          contentTitle={sectionLabel}
        />
      </nav>

      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{sectionLabel}</h1>
          {canEdit && branchMode && onEditRequest && (
            <Button
              variant="soft"
              size="2"
              onClick={onEditRequest}
              className={styles.editButton}
            >
              <Pencil1Icon />
              Edit
            </Button>
          )}
        </div>
      </header>

      {hasBody ? (
        <section className={styles.body} aria-label="Section overview">
          <Markdown>{body}</Markdown>
        </section>
      ) : canEdit && branchMode ? (
        <button
          type="button"
          className={styles.addOverview}
          onClick={onEditRequest}
          aria-label="Add section overview"
        >
          <Pencil1Icon />
          Add overview
        </button>
      ) : null}

      <section className={styles.cardSection} aria-label="Categories">
        <LandingPageCardGrid
          cards={cards}
          onCardClick={onCardClick}
          isLoading={isLoading}
          emptyMessage="No categories yet"
        />
      </section>
    </article>
  );
}
