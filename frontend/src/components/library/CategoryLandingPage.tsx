import Markdown from 'react-markdown';
import { Button } from '@radix-ui/themes';
import { Pencil1Icon } from '@radix-ui/react-icons';
import type { CategoryDTO } from '../../services/category-api';
import type { SubcategoryDTO } from '../../services/subcategory-api';
import type { ContentSummary } from '@echo-portal/shared';
import type { CardData, SubcategoryCardData, ContentItemCardData } from './LandingPageCardGrid';
import { LandingPageCardGrid, contentSummaryToCardData } from './LandingPageCardGrid';
import { ContentBreadcrumb } from './ContentBreadcrumb';
import styles from './CategoryLandingPage.module.css';

export interface CategoryLandingPageProps {
  section: string;
  category: CategoryDTO;
  subcategories: SubcategoryDTO[];
  contentItems: ContentSummary[];
  body: string;
  onEditRequest?: () => void;
  canEdit: boolean;
  branchMode?: boolean;
  onCardClick: (card: CardData) => void;
  isLoading?: boolean;
}

export function CategoryLandingPage({
  section,
  category,
  subcategories,
  contentItems,
  body,
  onEditRequest,
  canEdit,
  branchMode,
  onCardClick,
  isLoading,
}: CategoryLandingPageProps) {
  const hasBody = body.trim().length > 0;

  // Build mixed card grid: subcategory cards + content item cards
  const subcategoryCards: SubcategoryCardData[] = subcategories.map((sub) => ({
    type: 'subcategory' as const,
    id: sub.id,
    name: sub.name,
    contentCount: contentItems.filter((c) => c.subcategoryId === sub.id).length,
  }));

  // Content items not in any subcategory (loose content)
  const looseContentCards: ContentItemCardData[] = contentItems
    .filter((c) => !c.subcategoryId)
    .map((c) => contentSummaryToCardData(c, !c.isPublished));

  const cards: CardData[] = [...subcategoryCards, ...looseContentCards];

  return (
    <article className={styles.page} aria-label={`${category.name} category landing page`}>
      <nav aria-label="Breadcrumb">
        <ContentBreadcrumb
          section={section}
          categoryName={category.name}
          contentTitle={category.name}
        />
      </nav>

      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{category.name}</h1>
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
        <section className={styles.body} aria-label="Category overview">
          <Markdown>{body}</Markdown>
        </section>
      ) : canEdit && branchMode ? (
        <button
          type="button"
          className={styles.addOverview}
          onClick={onEditRequest}
          aria-label="Add category overview"
        >
          <Pencil1Icon />
          Add overview
        </button>
      ) : null}

      <section className={styles.cardSection} aria-label="Category contents">
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
