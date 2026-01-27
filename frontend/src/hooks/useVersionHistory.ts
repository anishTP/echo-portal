import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '../services/content-api';
import { useContentStore } from '../stores/contentStore';
import type { ContentRevertInput } from '@echo-portal/shared';

export const versionKeys = {
  all: ['versions'] as const,
  list: (contentId: string, params?: Record<string, unknown>) =>
    [...versionKeys.all, 'list', contentId, params] as const,
  detail: (contentId: string, versionId: string) =>
    [...versionKeys.all, 'detail', contentId, versionId] as const,
  diff: (contentId: string, from: string, to: string) =>
    [...versionKeys.all, 'diff', contentId, from, to] as const,
};

/**
 * Fetch paginated version history for a content item
 */
export function useVersionHistory(
  contentId: string | undefined,
  params?: { page?: number; limit?: number }
) {
  const setVersions = useContentStore((s) => s.setVersions);

  return useQuery({
    queryKey: versionKeys.list(contentId ?? '', params as Record<string, unknown>),
    queryFn: async () => {
      const result = await contentApi.getVersions(contentId!, params);
      setVersions(result.items);
      return result;
    },
    enabled: !!contentId,
  });
}

/**
 * Fetch a specific version detail
 */
export function useVersion(contentId: string | undefined, versionId: string | undefined) {
  return useQuery({
    queryKey: versionKeys.detail(contentId ?? '', versionId ?? ''),
    queryFn: () => contentApi.getVersion(contentId!, versionId!),
    enabled: !!contentId && !!versionId,
  });
}

/**
 * Fetch diff between two versions
 */
export function useVersionDiff(
  contentId: string | undefined,
  from: string | undefined,
  to: string | undefined
) {
  return useQuery({
    queryKey: versionKeys.diff(contentId ?? '', from ?? '', to ?? ''),
    queryFn: () => contentApi.diff(contentId!, from!, to!),
    enabled: !!contentId && !!from && !!to,
  });
}

/**
 * Revert content to a previous version
 */
export function useRevertContent(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContentRevertInput) => contentApi.revert(contentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionKeys.list(contentId) });
      queryClient.invalidateQueries({ queryKey: ['contents', 'detail', contentId] });
    },
  });
}
