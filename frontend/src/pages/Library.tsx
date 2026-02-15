import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams, useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { animate as animateEl } from 'animejs';
import type { JSAnimation } from 'animejs';
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
import { useAIStore } from '../stores/aiStore';
import { AIChatPanel } from '../components/ai/AIChatPanel';
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

  // AI store for chat panel toggle
  const aiStore = useAIStore();

  // State for selected content in branch mode (uses content ID, not slug)
  const [selectedBranchContentId, setSelectedBranchContentId] = useState<string | null>(null);

  // Extract mode and branch from URL (for inline edit mode and review mode)
  const mode = (searchParams.get('mode') as 'view' | 'edit' | 'review') || 'view';
  const branchId = searchParams.get('branchId') || undefined;
  const contentIdParam = searchParams.get('contentId') || undefined;
  const commentIdParam = searchParams.get('commentId') || undefined;

  // Determine if we're in inline edit mode (editing branch content)
  const isEditMode = mode === 'edit' && !!branchId && !!contentIdParam;

  // Determine if we're in review mode (in-context review overlay)
  const isReviewMode = mode === 'review' && !!branchId;

  // Effective branch ID for content list (from store or URL params in edit/review mode)
  const effectiveBranchId = currentBranch?.id || ((isEditMode || isReviewMode) ? branchId : undefined);

  // Extract filters from URL
  const _section = searchParams.get('section');
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

  // Refs for AI panel morph animation
  const panelRef = useRef<HTMLDivElement>(null);
  const panelAnimRef = useRef<JSAnimation | null>(null);
  const isFirstPanelRender = useRef(true);

  // Undo/redo availability for EditModeHeader buttons
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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

  // Auto-select content item matching a commentId from notification click
  useEffect(() => {
    if (!commentIdParam || !comments || comments.length === 0 || !contentComparison?.files) return;
    const comment = comments.find((c) => c.id === commentIdParam);
    if (!comment?.path) return;
    const matchingFile = contentComparison.files.find((f) => f.path === comment.path);
    if (matchingFile?.contentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional state sync from URL param
      setSelectedBranchContentId(matchingFile.contentId);
    }
  }, [commentIdParam, comments, contentComparison?.files]);

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

  // Handle done editing - exits immediately for concurrent animations, saves in background
  const handleDoneEditing = useCallback(() => {
    const currentBranchId = branchId;
    const currentContentId = contentIdParam;

    // Capture editor content before exit unmounts InlineEditView
    let mergedContent: DraftContent | null = null;
    if (inlineEditViewRef.current && currentDraft) {
      inlineEditViewRef.current.cancelPendingSave();
      const editorContent = inlineEditViewRef.current.getContent();
      mergedContent = {
        title: currentDraft.title,
        body: editorContent.body,
        metadata: currentDraft.metadata,
      };
    }

    // Exit edit mode immediately — triggers concurrent header/sidebar/content animations
    exitEditMode();

    // Save in background using captured values
    if (mergedContent) {
      (async () => {
        await autoSave.saveNow(mergedContent);
        await draftSync.sync();
        if (currentContentId) {
          await queryClient.invalidateQueries({ queryKey: contentKeys.detail(currentContentId) });
        }
        if (currentBranchId) {
          await queryClient.invalidateQueries({ queryKey: [...contentKeys.lists(), currentBranchId] });
        }
      })();
    }
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

  // AI panel visibility and mode derivation
  const showAIPanel = aiStore.panelOpen && (
    (isEditMode && !!branchId) ||
    (!isEditMode && !isReviewMode && !!user && !!selectedContent)
  );
  const isEditPanel = isEditMode && !!branchId;

  // Animate AI panel morph when switching between edit (sidebar) and preview (floating) modes
  useEffect(() => {
    if (!panelRef.current || !showAIPanel) {
      isFirstPanelRender.current = true;
      return;
    }

    const el = panelRef.current;

    // Compute target styles in pixels (anime.js interpolates numerics smoothly)
    const sidebarStyles = {
      top: 64,
      right: 0,
      width: 408,
      height: window.innerHeight - 64,
      borderRadius: 0,
    };
    const floatingStyles = {
      top: window.innerHeight - 496,
      right: 16,
      width: 380,
      height: 480,
      borderRadius: 12,
    };

    const target = isEditPanel ? sidebarStyles : floatingStyles;

    if (isFirstPanelRender.current) {
      // First render: set position instantly (no animation)
      isFirstPanelRender.current = false;
      Object.assign(el.style, {
        top: `${target.top}px`,
        right: `${target.right}px`,
        width: `${target.width}px`,
        height: `${target.height}px`,
        borderRadius: `${target.borderRadius}px`,
        boxShadow: isEditPanel ? 'var(--shadow-4)' : 'var(--shadow-5)',
        border: isEditPanel ? 'none' : '1px solid var(--gray-6)',
        borderLeft: isEditPanel ? '1px solid var(--gray-6)' : '',
      });
      return;
    }

    // Cancel any running animation
    panelAnimRef.current?.cancel();

    // CRITICAL: Normalize inline styles to computed px values before animation.
    // anime.js reads inline styles first (before getComputedStyle). If a previous
    // onComplete or other code set a non-numeric value (e.g. calc()), anime.js
    // would decompose it as a COMPLEX type and produce incorrect interpolations.
    const cs = getComputedStyle(el);
    el.style.top = cs.top;
    el.style.right = cs.right;
    el.style.width = cs.width;
    el.style.height = cs.height;
    el.style.borderRadius = cs.borderRadius;

    // Update non-animatable properties instantly
    el.style.boxShadow = isEditPanel ? 'var(--shadow-4)' : 'var(--shadow-5)';
    el.style.border = isEditPanel ? 'none' : '1px solid var(--gray-6)';
    el.style.borderLeft = isEditPanel ? '1px solid var(--gray-6)' : '';

    // Animate layout properties — all values are numeric px
    panelAnimRef.current = animateEl(el, {
      top: target.top,
      right: target.right,
      width: target.width,
      height: target.height,
      borderRadius: target.borderRadius,
      duration: 350,
      ease: 'out(3)',
      onComplete: () => {
        // Clear ref so cleanup doesn't cancel a completed animation
        panelAnimRef.current = null;
      },
    });

    return () => { panelAnimRef.current?.cancel(); };
  }, [isEditPanel, showAIPanel]);

  // Resize handler: keep panel pixel values in sync with viewport
  useEffect(() => {
    if (!showAIPanel || !panelRef.current) return;
    const onResize = () => {
      const el = panelRef.current;
      if (!el || panelAnimRef.current) return; // Skip while animating
      if (isEditPanel) {
        el.style.height = `${window.innerHeight - 64}px`;
      } else {
        el.style.top = `${window.innerHeight - 496}px`;
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [showAIPanel, isEditPanel]);

  // Determine content to display
  const contentForView = selectedContent;

  return (
  <>
    <DocumentationLayout
      fullWidth={isReviewMode && reviewDisplayMode === 'split'}
      contentRightOffset={isEditMode && aiStore.panelOpen ? 'var(--side-panel-width, 408px)' : undefined}
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
          branchState={activeBranch?.state || currentBranch?.state}
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
            onToggleAI={() => aiStore.togglePanel()}
            aiPanelOpen={aiStore.panelOpen}
            onUndo={() => inlineEditViewRef.current?.undo()}
            onRedo={() => inlineEditViewRef.current?.redo()}
            canUndo={canUndo}
            canRedo={canRedo}
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
          focusCommentId={commentIdParam}
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
          onHistoryChange={(u, r) => { setCanUndo(u); setCanRedo(r); }}
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
            onToggleAI={user && !isEditMode && !isReviewMode ? () => aiStore.togglePanel() : undefined}
            aiPanelOpen={aiStore.panelOpen}
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

    {/* AI Chat Panel — unified container with anime.js morph transition */}
    {showAIPanel && (
      <div
        ref={panelRef}
        className="fixed z-40 overflow-hidden"
        /* Position/size styles managed by anime.js effect */
      >
        {isEditPanel ? (
          <AIChatPanel
            branchId={branchId}
            contentId={contentIdParam}
            getDocumentBody={() => inlineEditViewRef.current?.getContent().body}
            getSelectionContext={() => inlineEditViewRef.current?.getSelectionContext() ?? { selectedText: null, cursorContext: null }}
            onContentAccepted={(aiContent, mode, selectedText) => {
              if (inlineEditViewRef.current) {
                if (mode === 'replace' && selectedText) {
                  const currentBody = inlineEditViewRef.current.getContent().body;
                  const newBody = currentBody.replace(selectedText, aiContent);
                  if (newBody !== currentBody) {
                    inlineEditViewRef.current.setBody(newBody);
                  } else {
                    inlineEditViewRef.current.replaceSelection(aiContent);
                  }
                } else if (mode === 'replace') {
                  inlineEditViewRef.current.setBody(aiContent);
                } else {
                  inlineEditViewRef.current.insertAtCursor(aiContent);
                }
              }
            }}
            onSelectionReferenced={() => inlineEditViewRef.current?.highlightSelection()}
            onSelectionCleared={() => inlineEditViewRef.current?.clearHighlight()}
          />
        ) : selectedContent ? (
          <AIChatPanel
            contentId={selectedContent.id}
            getDocumentBody={() => selectedContent?.currentVersion?.body}
            analysisOnly
          />
        ) : null}
      </div>
    )}
  </>
  );
}
