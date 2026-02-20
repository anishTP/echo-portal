import Markdown from 'react-markdown';
import { Button } from '@radix-ui/themes';
import { Pencil1Icon } from '@radix-ui/react-icons';
import type { SubcategoryDTO } from '../../services/subcategory-api';
import type { ContentSummary } from '@echo-portal/shared';
import type { CardData, ContentItemCardData } from './LandingPageCardGrid';
import { LandingPageCardGrid, contentSummaryToCardData } from './LandingPageCardGrid';
import { ContentBreadcrumb } from './ContentBreadcrumb';
import styles from './SubcategoryLandingPage.module.css';

export interface SubcategoryLandingPageProps {
  section: string;
  categoryName: string;
  subcategory: SubcategoryDTO;
  contentItems: ContentSummary[];
  onEditRequest?: () => void;
  canEdit: boolean;
  branchMode?: boolean;
  onCardClick: (card: CardData) => void;
  isLoading?: boolean;
}

export function SubcategoryLandingPage({
  section,
  categoryName,
  subcategory,
  contentItems,
  onEditRequest,
  canEdit,
  branchMode,
  onCardClick,
  isLoading,
}: SubcategoryLandingPageProps) {
  const hasBody = subcategory.body.trim().length > 0;

  const cards: ContentItemCardData[] = contentItems.map((c) =>
    contentSummaryToCardData(c, !c.isPublished)
  );

  return (
    <article className={styles.page} aria-label={`${subcategory.name} subcategory landing page`}>
      <nav aria-label="Breadcrumb">
        <ContentBreadcrumb
          section={section}
          categoryName={categoryName}
          subcategoryName={subcategory.name}
          contentTitle={subcategory.name}
        />
      </nav>

      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{subcategory.name}</h1>
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
        <section className={styles.body} aria-label="Subcategory overview">
          <Markdown>{subcategory.body}</Markdown>
        </section>
      ) : canEdit && branchMode ? (
        <button
          type="button"
          className={styles.addOverview}
          onClick={onEditRequest}
          aria-label="Add subcategory overview"
        >
          <Pencil1Icon />
          Add overview
        </button>
      ) : null}

      <section className={styles.cardSection} aria-label="Content items">
        <LandingPageCardGrid
          cards={cards}
          onCardClick={onCardClick}
          isLoading={isLoading}
          emptyMessage="No content yet"
        />
      </section>
    </article>
  );
}
