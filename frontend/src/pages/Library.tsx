import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
import { CreateContentDialog } from '../components/library/CreateContentDialog';
import { usePublishedContent, useContentBySlug, useCreateCategory, useRenameCategory, useDeleteCategory, useReorderCategories, usePersistentCategories, useSubcategoriesForCategories } from '../hooks/usePublishedContent';
import { useEditBranch } from '../hooks/useEditBranch';
import { useBranch, usePublishBranch } from '../hooks/useBranch';
import { useContent, useContentList, useCreateContent, useDeleteContent, contentKeys } from '../hooks/useContent';
import { contentApi } from '../services/content-api';
import { useAutoSave } from '../hooks/useAutoSave';
import { useDraftSync } from '../hooks/useDraftSync';
import { useContentComparison, useContentComparisonStats } from '../hooks/useContentComparison';
import { useBranchReviews, useApproveReview, useRequestChanges } from '../hooks/useReview';
import { useBranchComments } from '../hooks/useBranchComments';
import { useBranchStore } from '../stores/branchStore';
import { useAIStore } from '../stores/aiStore';
import { AIChatPanel } from '../components/ai/AIChatPanel';
import { AlertDialog, Button as RadixButton, Flex } from '@radix-ui/themes';
import { useAuth } from '../context/AuthContext';
import type { ContentSummary } from '@echo-portal/shared';
import type { TextSelection } from '../hooks/useTextSelection';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

export default function Library() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();

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
  const sectionParam = searchParams.get('section') || undefined;
  const categoryParam = searchParams.get('category') || undefined;
  // Map plural URL param (brands/products/experiences) to singular DB value (brand/product/experience)
  const sectionFromParam = sectionParam ? sectionParam.replace(/s$/, '') : undefined;
  const type = (searchParams.get('type') as ContentType) || 'all';
  const search = searchParams.get('q') || '';

  // Dialog state for branch creation
  const [showBranchDialog, setShowBranchDialog] = useState(false);

  // Dialog state for content creation in branch mode
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createCategory, setCreateCategory] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const createContent = useCreateContent();
  const createCategoryMutation = useCreateCategory();
  const renameCategoryMutation = useRenameCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const reorderCategoriesMutation = useReorderCategories();

  // Delete confirmation dialog state
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<string | null>(null);
  const [deleteContentTarget, setDeleteContentTarget] = useState<string | null>(null);

  // Sidebar content delete mutation (separate from edit-mode delete)
  const sidebarDeleteContent = useDeleteContent(currentBranch?.id || branchId);

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

  // Fetch selected content by slug early so we can derive section from it
  const {
    data: publishedSelectedContent,
    isLoading: isLoadingPublishedContent,
    isError: isPublishedContentError,
    refetch: refetchPublishedContent,
  } = useContentBySlug(isInBranchMode ? undefined : slug);

  // Derive effective section: from URL param, or from currently viewed content's section.
  // When navigating to /library/{slug}, the section param is lost, but the content
  // itself knows which section it belongs to — use that to scope the sidebar.
  const sectionFilter = sectionFromParam || publishedSelectedContent?.section || undefined;

  // Fetch persistent categories for the current section (for sidebar display)
  const { data: persistentCategoryData } = usePersistentCategories(sectionFilter);
  const persistentCategoryList = useMemo(
    () => persistentCategoryData ?? [],
    [persistentCategoryData]
  );

  // Fetch subcategories for all categories in the current section
  const categoryIds = useMemo(
    () => persistentCategoryList.map((c) => c.id),
    [persistentCategoryList]
  );
  const { data: subcategoryData } = useSubcategoriesForCategories(categoryIds);
  const subcategoryList = useMemo(
    () => subcategoryData ?? [],
    [subcategoryData]
  );

  // Fetch published content for sidebar (when NOT in branch mode)
  const {
    data: publishedContent,
    isLoading: isLoadingPublished,
  } = usePublishedContent({
    contentType: type === 'all' ? undefined : type,
    section: sectionFilter,
    category: categoryParam,
    search: search || undefined,
    limit: 100,
  });

  // Fetch branch content for sidebar (when in branch mode OR edit mode)
  const {
    data: branchContentList,
    isLoading: isLoadingBranchList,
  } = useContentList(effectiveBranchId, {
    contentType: type === 'all' ? undefined : type,
    section: sectionFilter,
    category: categoryParam,
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
  useContentComparisonStats(
    isReviewMode ? effectiveBranchId : undefined
  );

  // Reviews for review mode OR for checking if there's feedback to view
  // Fetch for the effectiveBranchId (even if not in review mode) to check for completed feedback
  const { data: branchReviews } = useBranchReviews(effectiveBranchId);
  const approveReview = useApproveReview();
  const requestChanges = useRequestChanges();
  const publishBranch = usePublishBranch();

  // Find the active review (current user's pending/in_progress review)
  const activeReview = branchReviews?.find(
    (r) => r.reviewerId === user?.id && (r.status === 'pending' || r.status === 'in_progress')
  ) ?? null;

  // Find the most recent review with feedback (for showing comments to author after changes requested)
  // This allows authors to see the comments from completed reviews
  const reviewWithFeedback = branchReviews?.find(
    (r) => r.status === 'completed' && r.decision === 'changes_requested'
  ) ?? null;

  // Use active review if available, otherwise any active review on branch, otherwise review with feedback
  // Check if there's feedback to view (for drafts after changes_requested)
  // Only show when branch is in DRAFT state (not after resubmission when it goes to REVIEW)
  const branchInDraftState = activeBranch?.state === 'draft' || currentBranch?.state === 'draft';

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
    if (isInBranchMode || isReviewMode) {
      // Branch/review mode: auto-select first content item
      if (!selectedBranchContentId && !isLoadingBranchList) {
        // In review mode, prefer first file from content comparison
        if (isReviewMode && contentComparison?.files && contentComparison.files.length > 0 && contentComparison.files[0].contentId) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional state sync on data load
          setSelectedBranchContentId(contentComparison.files[0].contentId);
        } else if (branchContentList?.items && branchContentList.items.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional state sync on data load
          setSelectedBranchContentId(branchContentList.items[0].id);
        }
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
    isReviewMode,
    slug,
    selectedBranchContentId,
    publishedContent?.items,
    branchContentList?.items,
    contentComparison?.files,
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
  }, [currentBranch?.id, branchId]);

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

  // Handle add content button click in sidebar category
  const handleAddContent = useCallback((category: string) => {
    setCreateCategory(category);
    setCreateError(null);
    setShowCreateDialog(true);
  }, []);

  // Handle add category from sidebar (admin only)
  const handleAddCategory = useCallback(
    (name: string) => {
      if (!sectionFilter) return;
      createCategoryMutation.mutate({ name, section: sectionFilter });
    },
    [sectionFilter, createCategoryMutation]
  );

  // Dialog state for branch-required prompt (category creation outside branch mode)
  const [showBranchRequiredDialog, setShowBranchRequiredDialog] = useState(false);

  const handleAddCategoryNeedsBranch = useCallback(() => {
    setShowBranchRequiredDialog(true);
  }, []);

  // Handle category rename from sidebar context menu
  const handleRenameCategory = useCallback(
    (oldName: string, newName: string) => {
      if (!sectionFilter) return;
      renameCategoryMutation.mutate({ section: sectionFilter, oldName, newName });
    },
    [sectionFilter, renameCategoryMutation]
  );

  // Handle category delete from sidebar context menu (shows confirmation)
  const handleDeleteCategory = useCallback((name: string) => {
    setDeleteCategoryTarget(name);
  }, []);

  // Handle category reorder from sidebar context menu
  const handleReorderCategory = useCallback(
    (section: string, orderedNames: string[]) => {
      reorderCategoriesMutation.mutate({ section, order: orderedNames });
    },
    [reorderCategoriesMutation]
  );

  // Confirm category deletion
  const confirmDeleteCategory = useCallback(() => {
    if (!deleteCategoryTarget || !persistentCategoryList.length) return;
    const cat = persistentCategoryList.find((c) => c.name === deleteCategoryTarget);
    if (cat) {
      deleteCategoryMutation.mutate(cat.id);
    }
    setDeleteCategoryTarget(null);
  }, [deleteCategoryTarget, persistentCategoryList, deleteCategoryMutation]);

  // Handle content rename from sidebar context menu
  const handleRenameContent = useCallback(
    async (contentId: string, newTitle: string) => {
      try {
        const content = await contentApi.getById(contentId);
        await contentApi.update(contentId, {
          title: newTitle,
          body: content.currentVersion?.body || '',
          changeDescription: `Renamed to "${newTitle}"`,
        });
        // Invalidate to refresh sidebar
        const targetBranchId = currentBranch?.id || branchId;
        if (targetBranchId) {
          queryClient.invalidateQueries({ queryKey: [...contentKeys.lists(), targetBranchId] });
        }
        queryClient.invalidateQueries({ queryKey: contentKeys.detail(contentId) });
      } catch {
        // Silently fail — user sees the old title remain
      }
    },
    [currentBranch?.id, branchId, queryClient]
  );

  // Handle content delete from sidebar context menu (shows confirmation)
  const handleDeleteContentFromSidebar = useCallback((contentId: string) => {
    setDeleteContentTarget(contentId);
  }, []);

  // Confirm content deletion from sidebar
  const confirmDeleteContent = useCallback(async () => {
    if (!deleteContentTarget) return;
    try {
      await sidebarDeleteContent.mutateAsync(deleteContentTarget);
      // If deleted content was selected, clear selection
      if (selectedBranchContentId === deleteContentTarget) {
        setSelectedBranchContentId(null);
      }
    } catch {
      // Silently fail
    }
    setDeleteContentTarget(null);
  }, [deleteContentTarget, sidebarDeleteContent, selectedBranchContentId]);

  // Handle content creation confirmation
  const handleCreateConfirm = useCallback(
    async (title: string, contentType: 'guideline' | 'asset' | 'opinion') => {
      const targetBranchId = currentBranch?.id || branchId;
      if (!targetBranchId) return;

      setCreateError(null);
      try {
        const result = await createContent.mutateAsync({
          branchId: targetBranchId,
          title,
          contentType,
          section: sectionFilter as 'brand' | 'product' | 'experience' | undefined,
          category: createCategory !== 'Uncategorized' ? createCategory : undefined,
          body: ' ',
          changeDescription: 'Initial content creation',
        });
        setShowCreateDialog(false);
        // Enter edit mode for the new content
        enterEditMode(targetBranchId, result.id);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create content');
      }
    },
    [currentBranch?.id, branchId, createContent, createCategory, sectionFilter, enterEditMode]
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
          items={items}
          selectedSlug={showBranchContent ? undefined : slug}
          selectedContentId={showBranchContent ? (contentIdParam || selectedBranchContentId) ?? undefined : undefined}
          onSelectContent={showBranchContent ? handleSelectBranchContent : undefined}
          branchMode={showBranchContent}
          branchState={activeBranch?.state || currentBranch?.state}
          branchId={currentBranch?.id || activeBranch?.id}
          isOwner={!!user && (currentBranch?.ownerId === user.id || activeBranch?.ownerId === user.id)}
          persistentCategories={persistentCategoryList}
          subcategories={subcategoryList}
          onAddContent={handleAddContent}
          isAdmin={hasRole('administrator')}
          currentSection={sectionFilter}
          onAddCategory={handleAddCategory}
          onAddCategoryNeedsBranch={handleAddCategoryNeedsBranch}
          onRenameCategory={handleRenameCategory}
          onDeleteCategory={handleDeleteCategory}
          onReorderCategory={handleReorderCategory}
          onRenameContent={handleRenameContent}
          onDeleteContent={handleDeleteContentFromSidebar}
          canManageContent={hasRole('administrator') || hasRole('contributor')}
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
            branchState={activeBranch?.state}
            canPublish={activeBranch?.permissions?.canPublish ?? false}
            onPublish={async () => {
              if (activeBranch) {
                await publishBranch.mutateAsync(activeBranch.id);
                exitReviewMode();
              }
            }}
            isPublishing={publishBranch.isPending}
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

          {/* Content creation dialog (branch mode) */}
          <CreateContentDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            category={createCategory}
            onConfirm={handleCreateConfirm}
            isLoading={createContent.isPending}
            error={createError ?? undefined}
          />

          {/* Branch required dialog (category creation outside branch mode) */}
          <AlertDialog.Root open={showBranchRequiredDialog} onOpenChange={setShowBranchRequiredDialog}>
            <AlertDialog.Content maxWidth="420px">
              <AlertDialog.Title>Draft branch required</AlertDialog.Title>
              <AlertDialog.Description size="2">
                Categories can only be added in a draft branch. Use the branch selector to create or switch to a draft branch, then try again.
              </AlertDialog.Description>
              <Flex justify="end" mt="4">
                <AlertDialog.Action>
                  <RadixButton>OK</RadixButton>
                </AlertDialog.Action>
              </Flex>
            </AlertDialog.Content>
          </AlertDialog.Root>

          {/* Delete category confirmation dialog */}
          <AlertDialog.Root open={!!deleteCategoryTarget} onOpenChange={(open) => { if (!open) setDeleteCategoryTarget(null); }}>
            <AlertDialog.Content maxWidth="420px">
              <AlertDialog.Title>Delete category?</AlertDialog.Title>
              <AlertDialog.Description size="2">
                This will permanently delete the &ldquo;{deleteCategoryTarget}&rdquo; category. Content items in this category will become uncategorized.
              </AlertDialog.Description>
              <Flex justify="end" gap="3" mt="4">
                <AlertDialog.Cancel>
                  <RadixButton variant="soft" color="gray">Cancel</RadixButton>
                </AlertDialog.Cancel>
                <AlertDialog.Action>
                  <RadixButton color="red" onClick={confirmDeleteCategory}>Delete</RadixButton>
                </AlertDialog.Action>
              </Flex>
            </AlertDialog.Content>
          </AlertDialog.Root>

          {/* Delete content confirmation dialog */}
          <AlertDialog.Root open={!!deleteContentTarget} onOpenChange={(open) => { if (!open) setDeleteContentTarget(null); }}>
            <AlertDialog.Content maxWidth="420px">
              <AlertDialog.Title>Delete content?</AlertDialog.Title>
              <AlertDialog.Description size="2">
                This will permanently delete this content item from the branch. This action cannot be undone.
              </AlertDialog.Description>
              <Flex justify="end" gap="3" mt="4">
                <AlertDialog.Cancel>
                  <RadixButton variant="soft" color="gray">Cancel</RadixButton>
                </AlertDialog.Cancel>
                <AlertDialog.Action>
                  <RadixButton color="red" onClick={confirmDeleteContent}>Delete</RadixButton>
                </AlertDialog.Action>
              </Flex>
            </AlertDialog.Content>
          </AlertDialog.Root>
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
