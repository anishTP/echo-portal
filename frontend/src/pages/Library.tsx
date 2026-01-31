import { useCallback, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { DocumentationLayout } from '../components/layout';
import { LibrarySidebar, ContentRenderer, ContentMetadataSidebar } from '../components/library';
import { usePublishedContent, useContentBySlug } from '../hooks/usePublishedContent';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

export default function Library() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract filters from URL
  const type = (searchParams.get('type') as ContentType) || 'all';
  const search = searchParams.get('q') || '';

  // Fetch all published content for sidebar
  const {
    data: allContent,
    isLoading: isLoadingList,
  } = usePublishedContent({
    contentType: type === 'all' ? undefined : type,
    search: search || undefined,
    limit: 100, // Fetch all for sidebar
  });

  // Fetch selected content by slug
  const {
    data: selectedContent,
    isLoading: isLoadingContent,
    isError: isContentError,
    refetch: refetchContent,
  } = useContentBySlug(slug);

  // Auto-select first item if no slug specified and content is available
  useEffect(() => {
    if (!slug && allContent?.items && allContent.items.length > 0 && !isLoadingList) {
      const firstItem = allContent.items[0];
      navigate(`/library/${firstItem.slug}`, { replace: true });
    }
  }, [slug, allContent?.items, isLoadingList, navigate]);

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === '' || value === 'all') {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        });
        return next;
      });
    },
    [setSearchParams]
  );

  const handleTypeChange = useCallback(
    (value: ContentType) => {
      updateParams({ type: value });
    },
    [updateParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({ q: value });
    },
    [updateParams]
  );

  const handleClearFilters = useCallback(() => {
    updateParams({ type: null, q: null });
  }, [updateParams]);

  const hasActiveFilters = type !== 'all' || search !== '';
  const items = allContent?.items ?? [];

  // Get markdown body for TOC
  const markdownBody = selectedContent?.currentVersion?.body || '';

  // Prepare metadata for right sidebar
  const publishedDate = selectedContent?.publishedAt
    ? new Date(selectedContent.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined;

  return (
    <DocumentationLayout
      sidebar={
        <LibrarySidebar
          search={search}
          onSearchChange={handleSearchChange}
          contentType={type}
          onContentTypeChange={handleTypeChange}
          items={items}
          selectedSlug={slug}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      }
      rightSidebar={
        selectedContent ? (
          <ContentMetadataSidebar
            author={{
              name: selectedContent.createdBy.displayName,
              avatarUrl: selectedContent.createdBy.avatarUrl,
            }}
            publishedDate={publishedDate}
            category={selectedContent.category}
            tags={selectedContent.tags}
            markdown={markdownBody}
          />
        ) : undefined
      }
    >
      <ContentRenderer
        content={selectedContent ?? null}
        isLoading={isLoadingContent || (isLoadingList && !slug)}
        isError={isContentError}
        onRetry={() => refetchContent()}
      />
    </DocumentationLayout>
  );
}
