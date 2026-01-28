import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '../services/content-api';
import { useContentStore } from '../stores/contentStore';
import type { ContentCreateInput, ContentUpdateInput } from '@echo-portal/shared';

export const contentKeys = {
  all: ['contents'] as const,
  lists: () => [...contentKeys.all, 'list'] as const,
  list: (branchId: string, filters?: Record<string, string>) =>
    [...contentKeys.lists(), branchId, filters] as const,
  details: () => [...contentKeys.all, 'detail'] as const,
  detail: (id: string) => [...contentKeys.details(), id] as const,
  published: (filters?: Record<string, string>) =>
    [...contentKeys.all, 'published', filters] as const,
  publishedBySlug: (slug: string) =>
    [...contentKeys.all, 'published', 'slug', slug] as const,
  search: (q: string, filters?: Record<string, string>) =>
    [...contentKeys.all, 'search', q, filters] as const,
};

/**
 * Fetch a single content item with its current version
 */
export function useContent(id: string | undefined) {
  const setCurrentContent = useContentStore((s) => s.setCurrentContent);

  return useQuery({
    queryKey: contentKeys.detail(id ?? ''),
    queryFn: async () => {
      const content = await contentApi.getById(id!);
      setCurrentContent(content);
      return content;
    },
    enabled: !!id,
  });
}

/**
 * Fetch content list for a branch
 */
export function useContentList(
  branchId: string | undefined,
  params?: { contentType?: string; category?: string; page?: number; limit?: number }
) {
  const setBranchContents = useContentStore((s) => s.setBranchContents);

  return useQuery({
    queryKey: contentKeys.list(branchId ?? '', params as Record<string, string>),
    queryFn: async () => {
      const result = await contentApi.listByBranch({
        branchId: branchId!,
        ...params,
      });
      setBranchContents(result.items);
      return result;
    },
    enabled: !!branchId,
  });
}

/**
 * Create new content mutation
 */
export function useCreateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContentCreateInput) => contentApi.create(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
      useContentStore.getState().setCurrentContent(data);
    },
  });
}

/**
 * Update content mutation (creates new version)
 */
export function useUpdateContent(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContentUpdateInput) => contentApi.update(contentId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contentKeys.detail(contentId) });
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
      useContentStore.getState().setCurrentContent(data);
    },
  });
}
