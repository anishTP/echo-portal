import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocumentationLayout } from '../components/layout';
import { LibrarySidebar, LibraryGrid, Pagination } from '../components/library';
import { usePublishedContent, useCategories } from '../hooks/usePublishedContent';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract filters from URL
  const type = (searchParams.get('type') as ContentType) || 'all';
  const category = searchParams.get('category') || '';
  const search = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Fetch data
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = usePublishedContent({
    contentType: type === 'all' ? undefined : type,
    category: category || undefined,
    search: search || undefined,
    page,
    limit: 12,
  });

  const { categories, categoryCounts } = useCategories();

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === '' || value === 'all' || (key === 'page' && value === '1')) {
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
      updateParams({ type: value, page: null });
    },
    [updateParams]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      updateParams({ category: value === '' ? null : value, page: null });
    },
    [updateParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({ q: value, page: null });
    },
    [updateParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams({ page: String(newPage) });
    },
    [updateParams]
  );

  const handleClearFilters = useCallback(() => {
    updateParams({ type: null, category: null, q: null, page: null });
  }, [updateParams]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;
  const hasActiveFilters = type !== 'all' || category !== '' || search !== '';

  return (
    <DocumentationLayout
      sidebar={
        <LibrarySidebar
          search={search}
          onSearchChange={handleSearchChange}
          contentType={type}
          onContentTypeChange={handleTypeChange}
          category={category}
          onCategoryChange={handleCategoryChange}
          categories={categories}
          categoryCounts={categoryCounts}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      }
    >
      {/* Content Grid */}
      <LibraryGrid
        items={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={data.total}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </DocumentationLayout>
  );
}
