import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams, useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DocumentationLayout } from '../components/layout';
import {
  LibrarySidebar,
  ContentRenderer,
  ContentMetadataSidebar,
} from '../components/library';
import { InlineEditView, type DraftContent, type InlineEditViewHandle } from '../components/library/InlineEditView';
import { EditMetadataSidebar } from '../components/library/EditMetadataSidebar';
import { EditModeHeader } from '../components/library/EditModeHeader';
import { BranchCreateDialog } from '../components/editor/BranchCreateDialog';
import { usePublishedContent, useContentBySlug } from '../hooks/usePublishedContent';
import { useEditBranch } from '../hooks/useEditBranch';
import { useBranch } from '../hooks/useBranch';
import { useContent, useContentList, contentKeys } from '../hooks/useContent';
import { useAutoSave } from '../hooks/useAutoSave';
import { useDraftSync } from '../hooks/useDraftSync';
import { useBranchStore } from '../stores/branchStore';
import type { ContentSummary } from '@echo-portal/shared';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

export default function Library() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Get current branch from store (set by BranchSelector)
  const currentBranch = useBranchStore((s) => s.currentBranch);
  const isInBranchMode = currentBranch !== null;

  // State for selected content in branch mode (uses content ID, not slug)
  const [selectedBranchContentId, setSelectedBranchContentId] = useState<string | null>(null);

  // Extract mode and branch from URL (for inline edit mode)
  const mode = (searchParams.get('mode') as 'view' | 'edit') || 'view';
  const branchId = searchParams.get('branchId') || undefined;
  const contentIdParam = searchParams.get('contentId') || undefined;

  // Extract filters from URL
  const type = (searchParams.get('type') as ContentType) || 'all';
  const search = searchParams.get('q') || '';

  // Dialog state for branch creation
  const [showBranchDialog, setShowBranchDialog] = useState(false);

  // Edit state
  const [currentDraft, setCurrentDraft] = useState<DraftContent | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Ref to access InlineEditView's content
  const inlineEditViewRef = useRef<InlineEditViewHandle>(null);

  // Fetch published content for sidebar (when NOT in branch mode)
  const {
    data: publishedContent,
    isLoading: isLoadingPublished,
  } = usePublishedContent({
    contentType: type === 'all' ? undefined : type,
    search: search || undefined,
    limit: 100,
  });

  // Fetch branch content for sidebar (when in branch mode)
  const {
    data: branchContentList,
    isLoading: isLoadingBranchList,
  } = useContentList(currentBranch?.id, {
    contentType: type === 'all' ? undefined : type,
  });

  // Determine which content list to use
  const isLoadingList = isInBranchMode ? isLoadingBranchList : isLoadingPublished;
  const items: ContentSummary[] = isInBranchMode
    ? (branchContentList?.items ?? [])
    : (publishedContent?.items ?? []);

  // Fetch selected content by slug (published version - when NOT in branch mode)
  const {
    data: publishedSelectedContent,
    isLoading: isLoadingPublishedContent,
    isError: isPublishedContentError,
    refetch: refetchPublishedContent,
  } = useContentBySlug(isInBranchMode ? undefined : slug);

  // Fetch selected content by ID (branch version - when in branch mode)
  const {
    data: branchSelectedContent,
    isLoading: isLoadingBranchContent,
    isError: isBranchContentError,
  } = useContent(isInBranchMode ? selectedBranchContentId ?? undefined : undefined);

  // Determine which selected content to use
  const selectedContent = isInBranchMode ? branchSelectedContent : publishedSelectedContent;
  const isLoadingContent = isInBranchMode ? isLoadingBranchContent : isLoadingPublishedContent;
  const isContentError = isInBranchMode ? isBranchContentError : isPublishedContentError;

  // Fetch branch data when in edit mode
  const { data: editBranch } = useBranch(branchId);

  // Fetch branch content when in edit mode
  const { data: editModeContent } = useContent(contentIdParam);

  // useEditBranch hook for creating edit branches
  const {
    createEditBranch,
    isLoading: isCreatingBranch,
    error: branchError,
    reset: resetBranchError,
  } = useEditBranch();

  // Auto-save and sync for edit mode
  const autoSave = useAutoSave({
    contentId: contentIdParam || '',
    branchId: branchId || '',
  });

  const draftSync = useDraftSync({
    contentId: contentIdParam || '',
    branchId: branchId || '',
  });

  // Auto-select first item when content list loads
  useEffect(() => {
    if (isInBranchMode) {
      // Branch mode: auto-select first branch content item
      if (!selectedBranchContentId && branchContentList?.items && branchContentList.items.length > 0 && !isLoadingBranchList) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional state sync on data load
        setSelectedBranchContentId(branchContentList.items[0].id);
      }
    } else {
      // Published mode: auto-navigate to first item by slug
      if (!slug && publishedContent?.items && publishedContent.items.length > 0 && !isLoadingPublished) {
        const firstItem = publishedContent.items[0];
        navigate(`/library/${firstItem.slug}`, { replace: true });
      }
    }
  }, [
    isInBranchMode,
    slug,
    selectedBranchContentId,
    publishedContent?.items,
    branchContentList?.items,
    isLoadingPublished,
    isLoadingBranchList,
    navigate,
  ]);

  // Clear selected branch content when switching branches or exiting branch mode
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional state reset on branch change
    setSelectedBranchContentId(null);
  }, [currentBranch?.id]);

  // Initialize draft content when entering edit mode or when editModeContent loads
  useEffect(() => {
    if (mode === 'edit' && editModeContent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional state sync on mode/content change
      setCurrentDraft({
        title: editModeContent.title,
        body: editModeContent.currentVersion?.body || '',
        metadata: {
          category: editModeContent.category,
          tags: editModeContent.tags,
          description: editModeContent.description,
        },
      });
    } else if (mode === 'view') {
      setCurrentDraft(null);
      setIsDirty(false);
    }
  }, [mode, editModeContent]);

  // Update params helper
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

  // Enter edit mode with branch
  const enterEditMode = useCallback(
    (newBranchId: string, newContentId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('mode', 'edit');
        next.set('branchId', newBranchId);
        next.set('contentId', newContentId);
        return next;
      });
    },
    [setSearchParams]
  );

  // Exit edit mode
  const exitEditMode = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('mode');
      next.delete('branchId');
      next.delete('contentId');
      return next;
    });
    setCurrentDraft(null);
    setIsDirty(false);
  }, [setSearchParams]);

  // Handle edit request from ContentRenderer
  const handleEditRequest = useCallback(() => {
    resetBranchError();

    // If already in branch mode, enter edit mode directly with current content
    if (isInBranchMode && currentBranch && selectedBranchContentId) {
      enterEditMode(currentBranch.id, selectedBranchContentId);
    } else {
      // Show branch creation dialog for published content
      setShowBranchDialog(true);
    }
  }, [resetBranchError, isInBranchMode, currentBranch, selectedBranchContentId, enterEditMode]);

  // Handle branch creation confirmation
  const handleBranchConfirm = useCallback(
    async (branchName: string, branchSlug: string) => {
      if (!selectedContent) return;

      const result = await createEditBranch(selectedContent.id, branchName, branchSlug);
      if (result) {
        setShowBranchDialog(false);
        enterEditMode(result.branch.id, result.content.id);
      }
    },
    [selectedContent, createEditBranch, enterEditMode]
  );

  // Handle content selection in branch mode
  const handleSelectBranchContent = useCallback((content: ContentSummary) => {
    setSelectedBranchContentId(content.id);
  }, []);

  // Handle metadata changes from sidebar
  const handleTitleChange = useCallback(
    (title: string) => {
      if (currentDraft) {
        const updated = { ...currentDraft, title };
        setCurrentDraft(updated);
        setIsDirty(true);
        autoSave.save(updated);
      }
    },
    [currentDraft, autoSave]
  );

  const handleCategoryChange = useCallback(
    (category: string) => {
      if (currentDraft) {
        const updated = {
          ...currentDraft,
          metadata: { ...currentDraft.metadata, category },
        };
        setCurrentDraft(updated);
        setIsDirty(true);
        autoSave.save(updated);
      }
    },
    [currentDraft, autoSave]
  );

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      if (currentDraft) {
        const updated = {
          ...currentDraft,
          metadata: { ...currentDraft.metadata, tags },
        };
        setCurrentDraft(updated);
        setIsDirty(true);
        autoSave.save(updated);
      }
    },
    [currentDraft, autoSave]
  );

  const handleDescriptionChange = useCallback(
    (description: string) => {
      if (currentDraft) {
        const updated = {
          ...currentDraft,
          metadata: { ...currentDraft.metadata, description },
        };
        setCurrentDraft(updated);
        setIsDirty(true);
        autoSave.save(updated);
      }
    },
    [currentDraft, autoSave]
  );

  // Handle save draft - merges body from editor with metadata from sidebar
  const handleSaveDraft = useCallback(async () => {
    if (inlineEditViewRef.current && currentDraft) {
      const editorContent = inlineEditViewRef.current.getContent();
      const mergedContent: DraftContent = {
        title: currentDraft.title,
        body: editorContent.body,
        metadata: currentDraft.metadata,
      };
      await autoSave.saveNow(mergedContent);
      await draftSync.sync();

      if (contentIdParam) {
        await queryClient.invalidateQueries({ queryKey: contentKeys.detail(contentIdParam) });
      }
      if (branchId) {
        await queryClient.invalidateQueries({ queryKey: contentKeys.list(branchId) });
      }
    }
  }, [currentDraft, autoSave, draftSync, contentIdParam, branchId, queryClient]);

  // Handle done editing - saves merged content and navigates to branch view
  const handleDoneEditing = useCallback(async () => {
    const currentBranchId = branchId;
    const currentContentId = contentIdParam;

    if (inlineEditViewRef.current && currentDraft) {
      const editorContent = inlineEditViewRef.current.getContent();
      const mergedContent: DraftContent = {
        title: currentDraft.title,
        body: editorContent.body,
        metadata: currentDraft.metadata,
      };
      await autoSave.saveNow(mergedContent);
      await draftSync.sync();

      if (currentContentId) {
        await queryClient.invalidateQueries({ queryKey: contentKeys.detail(currentContentId) });
      }
      if (currentBranchId) {
        await queryClient.invalidateQueries({ queryKey: contentKeys.list(currentBranchId) });
      }
    }

    setCurrentDraft(null);
    setIsDirty(false);

    // Stay on Library page (which now shows branch content) instead of navigating away
    exitEditMode();
  }, [branchId, contentIdParam, currentDraft, autoSave, draftSync, queryClient, exitEditMode]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    exitEditMode();
  }, [isDirty, exitEditMode]);

  // Handle cancel from header
  const handleCancel = useCallback(() => {
    handleDiscard();
  }, [handleDiscard]);

  // Filter handlers
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

  // Navigation blocker for unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (isDirty || autoSave.state.isDirty) &&
      mode === 'edit' &&
      currentLocation.pathname !== nextLocation.pathname
  );

  // Handle blocker
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const shouldProceed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (shouldProceed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Beforeunload handler for browser close/refresh
  useEffect(() => {
    if ((!isDirty && !autoSave.state.isDirty) || mode !== 'edit') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, autoSave.state.isDirty, mode]);

  const hasActiveFilters = type !== 'all' || search !== '';

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

  // Determine content to display
  const isEditMode = mode === 'edit' && branchId && contentIdParam;
  const contentForView = selectedContent;

  return (
    <DocumentationLayout
      sidebar={
        <LibrarySidebar
          search={search}
          onSearchChange={handleSearchChange}
          contentType={type}
          onContentTypeChange={handleTypeChange}
          items={items}
          selectedSlug={isInBranchMode ? undefined : slug}
          selectedContentId={isInBranchMode ? selectedBranchContentId ?? undefined : undefined}
          onSelectContent={isInBranchMode ? handleSelectBranchContent : undefined}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          branchMode={isInBranchMode}
          branchName={currentBranch?.name}
        />
      }
      rightSidebar={
        isEditMode && currentDraft ? (
          <EditMetadataSidebar
            title={currentDraft.title}
            category={currentDraft.metadata?.category}
            tags={currentDraft.metadata?.tags || []}
            description={currentDraft.metadata?.description}
            branchName={editBranch?.name || 'Edit Branch'}
            saveStatus={autoSave.state.status}
            syncStatus={draftSync.state.status}
            isDirty={isDirty || autoSave.state.isDirty}
            onTitleChange={handleTitleChange}
            onCategoryChange={handleCategoryChange}
            onTagsChange={handleTagsChange}
            onDescriptionChange={handleDescriptionChange}
            onSaveDraft={handleSaveDraft}
            onDoneEditing={handleDoneEditing}
            onDiscard={handleDiscard}
            isSaving={autoSave.state.status === 'saving'}
          />
        ) : contentForView ? (
          <ContentMetadataSidebar
            author={{
              name: contentForView.createdBy.displayName,
              avatarUrl: contentForView.createdBy.avatarUrl,
            }}
            publishedDate={publishedDate}
            category={contentForView.category}
            tags={contentForView.tags}
            markdown={markdownBody}
          />
        ) : undefined
      }
      header={
        isEditMode && editBranch ? (
          <EditModeHeader
            branchName={editBranch.name}
            contentTitle={currentDraft?.title || selectedContent?.title || 'Untitled'}
            hasUnsavedChanges={isDirty}
            onDone={handleDoneEditing}
            onCancel={handleCancel}
            isSaving={autoSave.state.status === 'saving'}
          />
        ) : undefined
      }
    >
      {isEditMode && editModeContent && currentDraft ? (
        <InlineEditView
          ref={inlineEditViewRef}
          content={editModeContent}
          branchId={branchId}
          branchName={editBranch?.name || 'Edit Branch'}
          onExitEditMode={exitEditMode}
        />
      ) : (
        <>
          <ContentRenderer
            content={contentForView ?? null}
            isLoading={isLoadingContent || (isLoadingList && !slug && !selectedBranchContentId)}
            isError={isContentError}
            onRetry={() => isInBranchMode ? undefined : refetchPublishedContent()}
            onEditRequest={handleEditRequest}
            branchMode={isInBranchMode}
          />

          {/* Branch creation dialog (only for published content) */}
          {!isInBranchMode && selectedContent && (
            <BranchCreateDialog
              open={showBranchDialog}
              onOpenChange={setShowBranchDialog}
              contentTitle={selectedContent.title}
              contentSlug={selectedContent.slug}
              onConfirm={handleBranchConfirm}
              isLoading={isCreatingBranch}
              error={branchError?.message}
            />
          )}
        </>
      )}
    </DocumentationLayout>
  );
}
