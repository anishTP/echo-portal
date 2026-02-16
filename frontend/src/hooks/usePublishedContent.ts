import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { contentApi } from '../services/content-api';
import { categoryApi, type CreateCategoryInput } from '../services/category-api';
import { contentKeys } from './useContent';

export interface PublishedContentParams {
  contentType?: string;
  section?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const categoryKeys = {
  all: ['categories'] as const,
  list: (section?: string) => [...categoryKeys.all, 'list', section] as const,
};

/**
 * Fetch published content with filtering and pagination
 */
export function usePublishedContent(params: PublishedContentParams = {}) {
  const { contentType, section, category, search, page = 1, limit = 12 } = params;

  const filterKey = useMemo(
    () => ({
      contentType: contentType || undefined,
      section: section || undefined,
      category: category || undefined,
      search: search || undefined,
      page: String(page),
      limit: String(limit),
    }),
    [contentType, section, category, search, page, limit]
  );

  return useQuery({
    queryKey: contentKeys.published(filterKey as Record<string, string>),
    queryFn: () =>
      contentApi.listPublished({
        contentType: contentType || undefined,
        section: section || undefined,
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
 * Fetch persistent categories from the API
 */
export function usePersistentCategories(section?: string) {
  return useQuery({
    queryKey: categoryKeys.list(section),
    queryFn: () => categoryApi.list(section),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Derive unique categories from published content with counts,
 * merged with persistent (admin-created) categories
 */
export function useCategories(section?: string) {
  // Fetch all published content to derive categories
  const { data, isLoading: isLoadingContent } = usePublishedContent({ section, limit: 100 });

  // Fetch persistent categories from the API
  const { data: persistentCategories, isLoading: isLoadingPersistent } = usePersistentCategories(section);

  const items = data?.items;

  const { categories, categoryCounts } = useMemo(() => {
    const countMap: Record<string, number> = {};

    // Count categories from content items
    if (items) {
      items.forEach((item) => {
        if (item.category) {
          countMap[item.category] = (countMap[item.category] || 0) + 1;
        }
      });
    }

    // Merge persistent categories (even if count=0)
    if (persistentCategories) {
      persistentCategories.forEach((cat) => {
        if (!(cat.name in countMap)) {
          countMap[cat.name] = 0;
        }
      });
    }

    const sortedCategories = Object.keys(countMap).sort();
    return { categories: sortedCategories, categoryCounts: countMap };
  }, [items, persistentCategories]);

  return { categories, categoryCounts, isLoading: isLoadingContent || isLoadingPersistent };
}

/**
 * Mutation to create a persistent category
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => categoryApi.create(input),
    onSuccess: (_data, variables) => {
      // Invalidate the category list for this section and all
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(variables.section) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(undefined) });
    },
  });
}

/**
 * Mutation to update (rename) a persistent category by ID
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      categoryApi.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
}

/**
 * Mutation to rename a category by name (works for both persistent and content-derived categories)
 */
export function useRenameCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { section: string; oldName: string; newName: string }) =>
      categoryApi.rename(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
}

/**
 * Mutation to reorder categories within a section
 */
export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ section, order }: { section: string; order: string[] }) =>
      categoryApi.reorder(section, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

/**
 * Mutation to delete a persistent category
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => categoryApi.delete(id),
    onSuccess: () => {
      // Invalidate all category lists
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}
