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
import { EditModeHeader } from '../components/library/EditModeHeader';
import { ReviewModeHeader } from '../components/library/ReviewModeHeader';
import { ReviewDiffView } from '../components/library/ReviewDiffView';
import { BranchCreateDialog } from '../components/editor/BranchCreateDialog';
import { usePublishedContent, useContentBySlug } from '../hooks/usePublishedContent';
import { useEditBranch } from '../hooks/useEditBranch';
import { useBranch } from '../hooks/useBranch';
import { useContent, useContentList, useDeleteContent, contentKeys } from '../hooks/useContent';
import { useAutoSave } from '../hooks/useAutoSave';
import { useDraftSync } from '../hooks/useDraftSync';
import { useContentComparison, useContentComparisonStats } from '../hooks/useContentComparison';
import { useBranchReviews, useApproveReview, useRequestChanges } from '../hooks/useReview';
import { useBranchComments } from '../hooks/useBranchComments';
import { useBranchStore } from '../stores/branchStore';
import { useAuth } from '../context/AuthContext';
import type { ContentSummary } from '@echo-portal/shared';
import type { TextSelection } from '../hooks/useTextSelection';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

export default function Library() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get current branch from store (set by BranchSelector)
  const currentBranch = useBranchStore((s) => s.currentBranch);
  const isInBranchMode = currentBranch !== null;

  // State for selected content in branch mode (uses content ID, not slug)
  const [selectedBranchContentId, setSelectedBranchContentId] = useState<string | null>(null);

  // Extract mode and branch from URL (for inline edit mode and review mode)
  const mode = (searchParams.get('mode') as 'view' | 'edit' | 'review') || 'view';
  const branchId = searchParams.get('branchId') || undefined;
  const contentIdParam = searchParams.get('contentId') || undefined;

  // Determine if we're in inline edit mode (editing branch content)
  const isEditMode = mode === 'edit' && !!branchId && !!contentIdParam;

  // Determine if we're in review mode (in-context review overlay)
  const isReviewMode = mode === 'review' && !!branchId;

  // Effective branch ID for content list (from store or URL params in edit/review mode)
  const effectiveBranchId = currentBranch?.id || ((isEditMode || isReviewMode) ? branchId : undefined);

  // Extract filters from URL
  const type = (searchParams.get('type') as ContentType) || 'all';
  const search = searchParams.get('q') || '';

  // Dialog state for branch creation
  const [showBranchDialog, setShowBranchDialog] = useState(false);

  // Edit state
  const [currentDraft, setCurrentDraft] = useState<DraftContent | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Fetch branch content for sidebar (when in branch mode OR edit mode)
  const {
    data: branchContentList,
    isLoading: isLoadingBranchList,
  } = useContentList(effectiveBranchId, {
    contentType: type === 'all' ? undefined : type,
  });

  // Determine which content list to use
  // In edit mode, we show branch content (the content being edited)
  // In branch mode (via BranchSelector), we show branch content
  // Otherwise, show published content
  const showBranchContent = isInBranchMode || isEditMode;
  const isLoadingList = showBranchContent ? isLoadingBranchList : isLoadingPublished;
  const items: ContentSummary[] = showBranchContent
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

  // Fetch branch data for the effective branch (either from URL in edit mode, or from store in branch mode)
  // This ensures the query is active so invalidation after submit-for-review triggers a refetch
  const { data: activeBranch } = useBranch(effectiveBranchId);

  // Content comparison for review mode (DB-backed, bypasses git worktrees)
  const { data: contentComparison, isLoading: isComparisonLoading } = useContentComparison(
    isReviewMode ? branchId : undefined
  );
  const { data: comparisonStats } = useContentComparisonStats(
    isReviewMode ? effectiveBranchId : undefined
  );

  // Reviews for review mode OR for checking if there's feedback to view
  // Fetch for the effectiveBranchId (even if not in review mode) to check for completed feedback
  const { data: branchReviews } = useBranchReviews(effectiveBranchId);
  const approveReview = useApproveReview();
  const requestChanges = useRequestChanges();

  // Find the active review (current user's pending/in_progress review)
  const activeReview = branchReviews?.find(
    (r) => r.reviewerId === user?.id && (r.status === 'pending' || r.status === 'in_progress')
  ) ?? null;

  // Find any active review on the branch (for author to reply to reviewer comments)
  const activeReviewOnBranch = branchReviews?.find(
    (r) => r.status === 'pending' || r.status === 'in_progress'
  ) ?? null;

  // Find the most recent review with feedback (for showing comments to author after changes requested)
  // This allows authors to see the comments from completed reviews
  const reviewWithFeedback = branchReviews?.find(
    (r) => r.status === 'completed' && r.decision === 'changes_requested'
  ) ?? null;

  // Use active review if available, otherwise any active review on branch, otherwise review with feedback
  const reviewForComments = activeReview ?? activeReviewOnBranch ?? reviewWithFeedback;

  // Check if there's feedback to view (for drafts after changes_requested)
  // Only show when branch is in DRAFT state (not after resubmission when it goes to REVIEW)
  const branchInDraftState = activeBranch?.state === 'draft' || currentBranch?.state === 'draft';
  const hasFeedbackToView = !!reviewWithFeedback && branchInDraftState;

  // Check if we're in feedback viewing mode (viewing comments from completed review, no active review)
  // Only valid when branch is in DRAFT state - after resubmission it should exit feedback mode
  const isFeedbackMode = isReviewMode && !activeReview && !!reviewWithFeedback && branchInDraftState;

  // Aggregate comments from ALL reviews on the branch (so author and reviewers see all comments)
  const {
    comments,
    addComment,
    replyToComment,
    resolveComment,
    unresolveComment,
  } = useBranchComments(effectiveBranchId, branchReviews, user?.id);

  // Selection-based commenting no longer needs explicit state tracking
  // The CommentPopover handles its own state via useTextSelection

  // Review display mode state
  const [reviewDisplayMode, setReviewDisplayMode] = useState<'unified' | 'split'>('unified');

  // Find the selected item's diff in review mode
  const selectedFileDiff = contentComparison?.files.find(
    (f) => f.contentId === (selectedBranchContentId || contentIdParam)
  ) ?? null;

  // Fetch branch content when in edit mode
  const { data: editModeContent } = useContent(contentIdParam);

  // useEditBranch hook for creating edit branches
  const {
    createEditBranch,
    isLoading: isCreatingBranch,
    error: branchError,
    reset: resetBranchError,
  } = useEditBranch();

  // Delete content mutation
  const deleteMutation = useDeleteContent(branchId);

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

  // Exit review mode
  const exitReviewMode = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('mode');
      next.delete('branchId');
      return next;
    });
  }, [setSearchParams]);

  // Enter feedback viewing mode (view comments from completed review)
  const enterFeedbackMode = useCallback(() => {
    if (effectiveBranchId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('mode', 'review');
        next.set('branchId', effectiveBranchId);
        return next;
      });
    }
  }, [effectiveBranchId, setSearchParams]);

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
      // Cancel any pending debounced saves from InlineEditView to prevent race conditions
      inlineEditViewRef.current.cancelPendingSave();

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
        // Use prefix ['contents', 'list', branchId] to match any filter variations
        await queryClient.invalidateQueries({ queryKey: [...contentKeys.lists(), branchId] });
      }
    }
  }, [currentDraft, autoSave, draftSync, contentIdParam, branchId, queryClient]);

  // Handle done editing - saves merged content and navigates to branch view
  const handleDoneEditing = useCallback(async () => {
    const currentBranchId = branchId;
    const currentContentId = contentIdParam;

    if (inlineEditViewRef.current && currentDraft) {
      // Cancel any pending debounced saves from InlineEditView to prevent race conditions
      inlineEditViewRef.current.cancelPendingSave();

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
        // Use prefix ['contents', 'list', branchId] to match any filter variations
        await queryClient.invalidateQueries({ queryKey: [...contentKeys.lists(), currentBranchId] });
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

  // Handler for submitting a selection-based comment
  const handleSubmitComment = useCallback(async (content: string, selection: TextSelection, filePath: string) => {
    await addComment.mutateAsync({
      content,
      path: filePath,
      line: selection.startOffset, // Keep for backwards compatibility
      side: 'new', // Default to 'new' side for selection-based comments
      // Store full selection data for highlighting
      selectedText: selection.text,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
    });
  }, [addComment]);

  // Handle delete content
  const handleDeleteContent = useCallback(async () => {
    if (!contentIdParam) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(contentIdParam);
      // After successful delete, exit edit mode and go back to library
      exitEditMode();
      navigate('/library');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete content');
    }
  }, [contentIdParam, deleteMutation, exitEditMode, navigate]);

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
  const contentForView = selectedContent;

  return (
    <DocumentationLayout
      fullWidth={isReviewMode && reviewDisplayMode === 'split'}
      sidebar={
        <LibrarySidebar
          search={search}
          onSearchChange={handleSearchChange}
          contentType={type}
          onContentTypeChange={handleTypeChange}
          items={items}
          selectedSlug={showBranchContent ? undefined : slug}
          selectedContentId={showBranchContent ? (contentIdParam || selectedBranchContentId) ?? undefined : undefined}
          onSelectContent={showBranchContent ? handleSelectBranchContent : undefined}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          branchMode={showBranchContent}
          branchName={currentBranch?.name || activeBranch?.name}
          branchState={(() => {
            const state = activeBranch?.state || currentBranch?.state;
            console.log('[Library] branchState for sidebar:', { activeBranchState: activeBranch?.state, currentBranchState: currentBranch?.state, result: state });
            return state;
          })()}
          branchId={currentBranch?.id || activeBranch?.id}
          isOwner={!!user && (currentBranch?.ownerId === user.id || activeBranch?.ownerId === user.id)}
          canSubmitForReview={activeBranch?.permissions?.canSubmitForReview}
          onSubmitForReviewSuccess={() => {
            // Branch query is already invalidated by SubmitForReviewButton via invalidateWorkflowQueries
            // If we were in feedback mode, exit review mode since branch is now in review state
            if (isFeedbackMode) {
              exitReviewMode();
            }
          }}
          onOpenReview={
            (activeBranch?.state || currentBranch?.state) === 'review' && effectiveBranchId
              ? () => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('mode', 'review');
                    next.set('branchId', effectiveBranchId);
                    return next;
                  });
                }
              : undefined
          }
          reviewStats={isReviewMode ? comparisonStats : undefined}
          hasFeedbackToView={hasFeedbackToView}
          onViewFeedback={hasFeedbackToView ? enterFeedbackMode : undefined}
        />
      }
      rightSidebar={
        isEditMode || isReviewMode ? undefined : contentForView ? (
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
        isEditMode && activeBranch ? (
          <EditModeHeader
            branchName={activeBranch.name}
            contentTitle={currentDraft?.title || selectedContent?.title || 'Untitled'}
            hasUnsavedChanges={isDirty || autoSave.state.isDirty}
            saveStatus={autoSave.state.status}
            onDone={handleDoneEditing}
            onCancel={handleCancel}
            onSaveDraft={handleSaveDraft}
            onDelete={handleDeleteContent}
            isSaving={autoSave.state.status === 'saving'}
            isDeleting={deleteMutation.isPending}
            deleteError={deleteError}
          />
        ) : isReviewMode ? (
          <ReviewModeHeader
            branchName={activeBranch?.name || ''}
            onClose={exitReviewMode}
            stats={contentComparison?.stats ?? null}
            displayMode={reviewDisplayMode}
            onDisplayModeChange={setReviewDisplayMode}
            reviews={branchReviews ?? []}
            activeReview={activeReview}
            currentUserId={user?.id || ''}
            onApprove={async (reason) => {
              if (activeReview) {
                await approveReview.mutateAsync({ id: activeReview.id, reason });
              }
            }}
            onRequestChanges={async (reason) => {
              if (activeReview) {
                await requestChanges.mutateAsync({ id: activeReview.id, reason });
              }
            }}
            isSubmitting={approveReview.isPending || requestChanges.isPending}
            feedbackMode={isFeedbackMode}
          />
        ) : undefined
      }
    >
      {isReviewMode ? (
        <ReviewDiffView
          file={selectedFileDiff}
          displayMode={reviewDisplayMode}
          isLoading={isComparisonLoading}
          comments={comments}
          onSubmitComment={handleSubmitComment}
          currentUserId={user?.id}
          branchAuthorId={activeBranch?.ownerId}
          onResolve={(commentId) => resolveComment.mutateAsync(commentId)}
          onUnresolve={(commentId) => unresolveComment.mutateAsync(commentId)}
          onReply={(commentId, content) => replyToComment.mutateAsync({ commentId, content })}
        />
      ) : isEditMode && editModeContent && currentDraft ? (
        <InlineEditView
          ref={inlineEditViewRef}
          content={editModeContent}
          branchId={branchId}
          branchName={activeBranch?.name || 'Edit Branch'}
          title={currentDraft.title}
          category={currentDraft.metadata?.category}
          description={currentDraft.metadata?.description}
          tags={currentDraft.metadata?.tags}
          onTitleChange={handleTitleChange}
          onCategoryChange={handleCategoryChange}
          onDescriptionChange={handleDescriptionChange}
          onTagsChange={handleTagsChange}
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
            branchState={activeBranch?.state}
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
