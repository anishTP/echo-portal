import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Select } from '@radix-ui/themes';
import {
  SearchBar,
  ContentTypeFilter,
  LibraryGrid,
  Pagination,
} from '../components/library';
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

  const { categories } = useCategories();

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
      updateParams({ category: value === 'all' ? null : value, page: null });
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

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Content Library</h1>
          <p className="mt-2 text-gray-600">
            Browse published guidelines, assets, and opinions.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="max-w-md">
            <SearchBar
              value={search}
              onChange={handleSearchChange}
              isLoading={isLoading && !!search}
              placeholder="Search by title, description, or category..."
            />
          </div>

          {/* Type Filter + Category */}
          <div className="flex flex-wrap items-center gap-4">
            <ContentTypeFilter value={type} onChange={handleTypeChange} />

            {categories.length > 0 && (
              <Select.Root
                value={category || 'all'}
                onValueChange={handleCategoryChange}
              >
                <Select.Trigger placeholder="All Categories" />
                <Select.Content>
                  <Select.Item value="all">All Categories</Select.Item>
                  {categories.map((cat) => (
                    <Select.Item key={cat} value={cat}>
                      {cat}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            )}

            {/* Active filter count */}
            {(type !== 'all' || category || search) && (
              <Button
                variant="ghost"
                size="2"
                onClick={() => updateParams({ type: null, category: null, q: null, page: null })}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Content Grid */}
        <LibraryGrid
          items={data?.items ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
        />

        {/* Pagination */}
        {data && (
          <div className="mt-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={data.total}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </main>
    </div>
  );
}
