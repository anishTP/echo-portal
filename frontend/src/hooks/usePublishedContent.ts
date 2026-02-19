import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { contentApi } from '../services/content-api';
import { categoryApi, type CreateCategoryInput } from '../services/category-api';
import { subcategoryApi } from '../services/subcategory-api';
import { contentKeys } from './useContent';
import { branchKeys } from './queryKeys';

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

export const subcategoryKeys = {
  all: ['subcategories'] as const,
  byCategory: (categoryId: string) => [...subcategoryKeys.all, 'byCategory', categoryId] as const,
  byCategories: (categoryIds: string[]) => [...subcategoryKeys.all, 'byCategories', ...categoryIds] as const,
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

/**
 * Fetch subcategories for all categories in a section.
 * Fetches subcategories for each category and merges results.
 */
export function useSubcategoriesForCategories(categoryIds: string[]) {
  return useQuery({
    queryKey: subcategoryKeys.byCategories(categoryIds),
    queryFn: async () => {
      if (categoryIds.length === 0) return [];
      const results = await Promise.all(
        categoryIds.map((id) => subcategoryApi.list(id))
      );
      return results.flat();
    },
    enabled: categoryIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to create a subcategory
 */
export function useCreateSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; categoryId: string; branchId: string }) =>
      subcategoryApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subcategoryKeys.all });
      queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
}

/**
 * Mutation to rename a subcategory
 */
export function useRenameSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name, branchId }: { id: string; name: string; branchId: string }) =>
      subcategoryApi.rename(id, { name, branchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subcategoryKeys.all });
    },
  });
}

/**
 * Mutation to delete a subcategory (cascade-deletes content)
 */
export function useDeleteSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) =>
      subcategoryApi.delete(id, branchId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: subcategoryKeys.all });
      queryClient.invalidateQueries({ queryKey: contentKeys.all });
      queryClient.invalidateQueries({ queryKey: branchKeys.detail(variables.branchId) });
    },
  });
}

/**
 * Mutation to reorder subcategories and loose content within a category
 */
export function useReorderSubcategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { categoryId: string; branchId: string; order: { type: 'subcategory' | 'content'; id: string }[] }) =>
      subcategoryApi.reorder(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: subcategoryKeys.all });
      queryClient.invalidateQueries({ queryKey: contentKeys.all });
      queryClient.invalidateQueries({ queryKey: branchKeys.detail(variables.branchId) });
    },
  });
}

/**
 * Mutation to move content between subcategories (DnD reassignment)
 */
export function useMoveContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contentId, ...input }: { contentId: string; branchId: string; subcategoryId: string | null; displayOrder: number }) =>
      subcategoryApi.moveContent(contentId, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: subcategoryKeys.all });
      queryClient.invalidateQueries({ queryKey: contentKeys.all });
      queryClient.invalidateQueries({ queryKey: branchKeys.detail(variables.branchId) });
    },
  });
}
