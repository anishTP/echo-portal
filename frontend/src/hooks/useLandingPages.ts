import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sectionPageApi, categoryPageApi } from '../services/landing-page-api';
import type { SectionPageDTO, CategoryPageDTO } from '@echo-portal/shared';

// Query key factory
export const landingPageKeys = {
  all: ['landingPages'] as const,
  sectionPages: () => [...landingPageKeys.all, 'section'] as const,
  sectionPage: (section: string, branchId?: string) =>
    [...landingPageKeys.sectionPages(), section, branchId] as const,
  categoryPages: () => [...landingPageKeys.all, 'category'] as const,
  categoryPage: (categoryId: string, branchId?: string) =>
    [...landingPageKeys.categoryPages(), categoryId, branchId] as const,
};

/**
 * Fetch section page body (with branch fallback)
 */
export function useSectionPage(section: string, branchId?: string) {
  return useQuery<SectionPageDTO>({
    queryKey: landingPageKeys.sectionPage(section, branchId),
    queryFn: () => sectionPageApi.get(section, branchId),
    enabled: !!section,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch category page body (with branch fallback)
 */
export function useCategoryPage(categoryId: string, branchId?: string) {
  return useQuery<CategoryPageDTO>({
    queryKey: landingPageKeys.categoryPage(categoryId, branchId),
    queryFn: () => categoryPageApi.get(categoryId, branchId),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to update a section page body
 */
export function useUpdateSectionPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ section, branchId, body }: { section: string; branchId: string; body: string }) =>
      sectionPageApi.update(section, branchId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: landingPageKeys.sectionPage(variables.section, variables.branchId),
      });
      // Also invalidate the published version key
      queryClient.invalidateQueries({
        queryKey: landingPageKeys.sectionPage(variables.section, undefined),
      });
    },
  });
}

/**
 * Mutation to update a category page body
 */
export function useUpdateCategoryPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, branchId, body }: { categoryId: string; branchId: string; body: string }) =>
      categoryPageApi.update(categoryId, branchId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: landingPageKeys.categoryPage(variables.categoryId, variables.branchId),
      });
      // Also invalidate the published version key
      queryClient.invalidateQueries({
        queryKey: landingPageKeys.categoryPage(variables.categoryId, undefined),
      });
    },
  });
}
