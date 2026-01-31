import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { contentApi } from '../services/content-api';
import { contentKeys } from './useContent';

export interface PublishedContentParams {
  contentType?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch published content with filtering and pagination
 */
export function usePublishedContent(params: PublishedContentParams = {}) {
  const { contentType, category, search, page = 1, limit = 12 } = params;

  const filterKey = useMemo(
    () => ({
      contentType: contentType || undefined,
      category: category || undefined,
      search: search || undefined,
      page: String(page),
      limit: String(limit),
    }),
    [contentType, category, search, page, limit]
  );

  return useQuery({
    queryKey: contentKeys.published(filterKey as Record<string, string>),
    queryFn: () =>
      contentApi.listPublished({
        contentType: contentType || undefined,
        category: category || undefined,
        search: search || undefined,
        page,
        limit,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single published content by slug
 */
export function useContentBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: contentKeys.publishedBySlug(slug ?? ''),
    queryFn: () => contentApi.getBySlug(slug!),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Derive unique categories from published content with counts
 */
export function useCategories() {
  // Fetch all published content to derive categories
  // In a real app, this might be a dedicated endpoint
  const { data, isLoading } = usePublishedContent({ limit: 100 });

  const items = data?.items;

  const { categories, categoryCounts } = useMemo(() => {
    if (!items) return { categories: [], categoryCounts: {} };

    const countMap: Record<string, number> = {};
    items.forEach((item) => {
      if (item.category) {
        countMap[item.category] = (countMap[item.category] || 0) + 1;
      }
    });

    const sortedCategories = Object.keys(countMap).sort();
    return { categories: sortedCategories, categoryCounts: countMap };
  }, [items]);

  return { categories, categoryCounts, isLoading };
}
