import { Badge } from '@radix-ui/themes';
import type { ContentSummary } from '@echo-portal/shared';
import styles from './LandingPageCardGrid.module.css';

// --- Card data types ---

export interface CategoryCardData {
  type: 'category';
  id: string;
  name: string;
  contentCount: number;
}

export interface SubcategoryCardData {
  type: 'subcategory';
  id: string;
  name: string;
  contentCount: number;
}

export interface ContentItemCardData {
  type: 'content';
  id: string;
  title: string;
  description?: string;
  contentType: string;
  authorName: string;
  isDraft?: boolean;
}

export type CardData = CategoryCardData | SubcategoryCardData | ContentItemCardData;

// --- Helpers ---

const typeColors: Record<string, 'green' | 'purple' | 'amber' | 'gray'> = {
  guideline: 'green',
  asset: 'purple',
  opinion: 'amber',
};

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

// --- Individual card components ---

function CategoryCard({
  data,
  onClick,
}: {
  data: CategoryCardData;
  onClick: () => void;
}) {
  return (
    <li
      className={styles.card}
      role="button"
      tabIndex={0}
      aria-label={`${data.name} — ${data.contentCount} items`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <h3 className={styles.cardTitle}>{data.name}</h3>
      <span className={styles.cardCount}>
        {data.contentCount} {data.contentCount === 1 ? 'item' : 'items'}
      </span>
    </li>
  );
}

function SubcategoryCard({
  data,
  onClick,
}: {
  data: SubcategoryCardData;
  onClick: () => void;
}) {
  return (
    <li
      className={styles.card}
      role="button"
      tabIndex={0}
      aria-label={`${data.name} — ${data.contentCount} items`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <h3 className={styles.cardTitle}>{data.name}</h3>
      <span className={styles.cardCount}>
        {data.contentCount} {data.contentCount === 1 ? 'item' : 'items'}
      </span>
    </li>
  );
}

function ContentItemCard({
  data,
  onClick,
}: {
  data: ContentItemCardData;
  onClick: () => void;
}) {
  return (
    <li
      className={styles.card}
      role="button"
      tabIndex={0}
      aria-label={`${data.title}${data.isDraft ? ' (Draft)' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Badge color={typeColors[data.contentType] || 'gray'} radius="full" size="1">
          {data.contentType.charAt(0).toUpperCase() + data.contentType.slice(1)}
        </Badge>
        {data.isDraft && <span className={styles.draftBadge}>Draft</span>}
      </div>
      <h3 className={styles.cardTitle} style={{ marginTop: 'var(--space-2)' }}>
        {data.title}
      </h3>
      {data.description && (
        <p className={styles.cardDescription}>
          {truncate(data.description, 120)}
        </p>
      )}
      <div className={styles.cardMeta}>
        <span>{data.authorName}</span>
      </div>
    </li>
  );
}

// --- Grid component ---

export interface LandingPageCardGridProps {
  cards: CardData[];
  onCardClick: (card: CardData) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

function CardGridSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Loading cards">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div style={{ height: 20, width: '60%', borderRadius: 4, background: 'var(--gray-a4)' }} />
          <div style={{ height: 14, width: '40%', borderRadius: 4, background: 'var(--gray-a3)', marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className={styles.emptyState}>
      <svg
        className={styles.emptyIcon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      <p>{message}</p>
    </div>
  );
}

export function LandingPageCardGrid({
  cards,
  onCardClick,
  isLoading,
  emptyMessage = 'No items found',
}: LandingPageCardGridProps) {
  if (isLoading) {
    return <CardGridSkeleton />;
  }

  if (cards.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <ul className={styles.cardGrid} role="list" aria-label="Landing page items">
      {cards.map((card) => {
        const key = `${card.type}-${card.id}`;
        switch (card.type) {
          case 'category':
            return (
              <CategoryCard key={key} data={card} onClick={() => onCardClick(card)} />
            );
          case 'subcategory':
            return (
              <SubcategoryCard key={key} data={card} onClick={() => onCardClick(card)} />
            );
          case 'content':
            return (
              <ContentItemCard key={key} data={card} onClick={() => onCardClick(card)} />
            );
        }
      })}
    </ul>
  );
}

// --- Helper to convert API data to card data ---

export function contentSummaryToCardData(content: ContentSummary, isDraft?: boolean): ContentItemCardData {
  return {
    type: 'content',
    id: content.id,
    title: content.title,
    description: content.description,
    contentType: content.contentType,
    authorName: content.createdBy.displayName,
    isDraft,
  };
}
