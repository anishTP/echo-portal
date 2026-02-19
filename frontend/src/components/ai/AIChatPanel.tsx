import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AIChatMessage } from './AIChatMessage.js';
import { SlashCommandInput } from './SlashCommandInput.js';
import { useAIAssist } from '../../hooks/useAIAssist.js';
import { useAIConversation } from '../../hooks/useAIConversation.js';
import { useAIStore } from '../../stores/aiStore.js';
import { api } from '../../services/api.js';
import { aiApi } from '../../services/ai-api.js';
import { PlusIcon, Cross2Icon, PaperPlaneIcon, StopIcon, ImageIcon } from '@radix-ui/react-icons';
import type { AIResponseMode } from '@echo-portal/shared';
import { AI_DEFAULTS } from '@echo-portal/shared';

function parseSlashCommand(input: string): { mode: AIResponseMode; prompt: string } {
  const trimmed = input.trimStart();
  if (trimmed.startsWith('/replace '))  return { mode: 'replace',  prompt: trimmed.slice('/replace '.length).trim() };
  if (trimmed.startsWith('/analyse '))  return { mode: 'analyse',  prompt: trimmed.slice('/analyse '.length).trim() };
  if (trimmed.startsWith('/analyze '))  return { mode: 'analyse',  prompt: trimmed.slice('/analyze '.length).trim() };
  if (trimmed.startsWith('/add '))      return { mode: 'add',      prompt: trimmed.slice('/add '.length).trim() };
  return { mode: 'add', prompt: input };
}

interface AIChatPanelProps {
  branchId?: string;
  contentId?: string;
  getDocumentBody?: () => string | undefined;
  getSelectionContext?: () => { selectedText: string | null; cursorContext: string | null };
  onContentAccepted?: (content: string, mode: 'add' | 'replace', selectedText?: string) => void;
  /** Called when a selection is referenced at submit time — used to highlight the range in the editor */
  onSelectionReferenced?: () => void;
  /** Called when the selection reference is cleared (accept/reject/cancel/new conversation) */
  onSelectionCleared?: () => void;
  /** When true, restricts to analysis-only mode (no content modification, stateless) */
  analysisOnly?: boolean;
}

/**
 * AIChatPanel — collapsible side panel with conversation UI (FR-014)
 *
 * Provides chat interface for content generation with multi-turn
 * conversation, streaming display, and accept/reject actions.
 * Checks AI enabled state from config (T044).
 */
export function AIChatPanel({ branchId, contentId, getDocumentBody, getSelectionContext, onContentAccepted, onSelectionReferenced, onSelectionCleared, analysisOnly }: AIChatPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<AIResponseMode>('add');
  const [aiEnabled, setAIEnabled] = useState(true);
  const [configChecked, setConfigChecked] = useState(false);
  const [selectionPreview, setSelectionPreview] = useState<string | null>(null);
  const [capturedSelectedText, setCapturedSelectedText] = useState<string | null>(null);
  const [promptSelectionLabel, setPromptSelectionLabel] = useState<string | null>(null);
  const [promptImageCount, setPromptImageCount] = useState(0);
  const [attachedImages, setAttachedImages] = useState<Array<{ file: File; preview: string; mediaType: string; data: string }>>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const store = useAIStore();
  const ai = useAIAssist();
  const conv = useAIConversation(branchId ?? null);

  const isStreaming = ai.streamStatus === 'streaming';
  // Block new requests while any unresolved request exists:
  // 1. Active SSE stream in progress
  // 2. Store-tracked pending request
  // 3. Completed stream awaiting accept/reject (non-analyse — those auto-dismiss)
  // 4. Historical pending/generating requests in conversation
  const hasUnresolvedStream = ai.streamStatus === 'complete' && ai.streamRequestId != null && currentMode !== 'analyse';
  const hasConversationPending = conv.conversation?.requests?.some(
    (req) => req.status === 'pending' || req.status === 'generating'
  ) ?? false;
  const hasPending = store.streamingStatus === 'streaming'
    || store.pendingRequest !== null
    || hasUnresolvedStream
    || hasConversationPending;

  // Check if AI is enabled from config (T044)
  useEffect(() => {
    api.get<{ config: { global: Record<string, unknown> } }>('/ai/config')
      .then((result) => {
        const enabled = result?.config?.global?.enabled;
        if (enabled === false) {
          setAIEnabled(false);
        }
        setConfigChecked(true);
      })
      .catch(() => {
        // Config not accessible (non-admin) — assume enabled
        setConfigChecked(true);
      });
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai.streamContent, conv.conversation?.requests?.length]);

  // Auto-dismiss analysis responses — reject backend request so user isn't blocked
  useEffect(() => {
    if (ai.streamStatus === 'complete' && currentMode === 'analyse') {
      if (ai.streamRequestId) {
        // Stateful mode: reject the backend request
        ai.reject(ai.streamRequestId).then(() => {
          ai.resetStream();
          conv.refreshConversation();
          setCurrentPrompt(null);
        });
      } else if (analysisOnly) {
        // Stateless mode (analysisOnly): no backend request to reject, just reset
        // Keep content visible — don't reset stream yet (user reads the response)
      }
    }
  }, [ai.streamStatus, currentMode, ai.streamRequestId, analysisOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  const processImageFile = useCallback(async (file: File): Promise<{ file: File; preview: string; mediaType: string; data: string } | null> => {
    if (!SUPPORTED_TYPES.includes(file.type)) return null;
    if (file.size > AI_DEFAULTS.MAX_IMAGE_SIZE_BYTES) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // dataUrl format: data:<mediaType>;base64,<data>
        const commaIdx = dataUrl.indexOf(',');
        const data = dataUrl.slice(commaIdx + 1);
        resolve({ file, preview: dataUrl, mediaType: file.type, data });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

  const addImages = useCallback(async (files: FileList | File[]) => {
    const remaining = AI_DEFAULTS.MAX_IMAGES_PER_REQUEST - attachedImages.length;
    if (remaining <= 0) return;
    const filesToProcess = Array.from(files).slice(0, remaining);
    const results = await Promise.all(filesToProcess.map(processImageFile));
    const valid = results.filter((r): r is NonNullable<typeof r> => r !== null);
    if (valid.length > 0) {
      setAttachedImages((prev) => [...prev, ...valid].slice(0, AI_DEFAULTS.MAX_IMAGES_PER_REQUEST));
    }
  }, [attachedImages.length, processImageFile]);

  const removeImage = useCallback((index: number) => {
    setAttachedImages((prev) => {
      const next = [...prev];
      // Revoke object URL if needed
      URL.revokeObjectURL(next[index]?.preview ?? '');
      next.splice(index, 1);
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      await addImages(e.dataTransfer.files);
    }
  }, [addImages]);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await addImages(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [addImages]);

  if (!store.panelOpen) return null;

  // Show disabled state when AI is off
  if (configChecked && !aiEnabled) {
    return (
      <div
        className="flex flex-col h-full"
        style={{ width: analysisOnly ? '100%' : 'var(--side-panel-width, 408px)', background: 'var(--color-background)', borderLeft: analysisOnly ? 'none' : '1px solid var(--gray-6)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: 'none' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--gray-12)' }}>AI Assistant</h3>
          <button
            onClick={() => store.setPanelOpen(false)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--gray-11)' }}
            title="Close panel"
          >
            <Cross2Icon />
          </button>
        </div>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--accent-9), var(--accent-7), transparent)' }} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-sm font-medium" style={{ color: 'var(--gray-11)' }}>AI Assistant is Disabled</p>
            <p className="text-xs mt-1" style={{ color: 'var(--gray-9)' }}>
              AI assistance has been disabled by your administrator.
              Contact an admin to enable AI features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isStreaming || hasPending || (!analysisOnly && !conv.hasRemainingTurns)) return;

    const submittedPrompt = prompt;
    setPrompt('');
    setCurrentPrompt(submittedPrompt);

    const parsed = parseSlashCommand(submittedPrompt);
    // In analysisOnly mode, force analyse regardless of slash command
    const mode = analysisOnly ? 'analyse' : parsed.mode;
    const cleanPrompt = parsed.prompt;
    setCurrentMode(mode);

    // Capture editor selection context at submit time
    const selCtx = getSelectionContext?.() ?? { selectedText: null, cursorContext: null };
    setCapturedSelectedText(selCtx.selectedText);

    // Store truncated selection label for display on the user message
    if (selCtx.selectedText) {
      const label = selCtx.selectedText.slice(0, 80) + (selCtx.selectedText.length > 80 ? '...' : '');
      setPromptSelectionLabel(label);
      // Highlight the referenced selection in the editor
      onSelectionReferenced?.();
    } else {
      setPromptSelectionLabel(null);
    }
    setSelectionPreview(null);

    // Prepare images for the request
    const images = attachedImages.length > 0
      ? attachedImages.map((img) => ({ mediaType: img.mediaType, data: img.data }))
      : undefined;
    setPromptImageCount(attachedImages.length);
    setAttachedImages([]);

    if (analysisOnly && !branchId) {
      // Stateless analysis — no conversation, no branchId
      await ai.generateAnalysis({
        contentId,
        prompt: cleanPrompt,
        context: getDocumentBody?.(),
        selectedText: selCtx.selectedText ?? undefined,
        cursorContext: selCtx.cursorContext ?? undefined,
        images,
      });
    } else {
      await ai.generate({
        branchId: branchId!,
        contentId,
        prompt: cleanPrompt,
        conversationId: conv.conversationId ?? undefined,
        context: getDocumentBody?.(),
        mode,
        selectedText: selCtx.selectedText ?? undefined,
        cursorContext: selCtx.cursorContext ?? undefined,
        images,
      });
      // Refresh conversation to get updated state
      await conv.refreshConversation();
    }
  };

  const handleAccept = async (requestId: string) => {
    if (!contentId) return;
    // Strip code fences and conversational preamble/postamble from AI output
    let acceptedContent = ai.streamContent;
    const fenceMatch = acceptedContent.match(/```(?:markdown|md)?\n([\s\S]*?)```/);
    if (fenceMatch) {
      acceptedContent = fenceMatch[1].trim();
    }

    // Compute the full document body to save to the server.
    // For replace mode with selected text, splice the AI snippet into the document;
    // for add mode, append to the current body; for analyse, use current body as-is.
    let editedContent: string | undefined;
    const currentBody = getDocumentBody?.();
    if (currentMode === 'replace' && capturedSelectedText && currentBody != null) {
      editedContent = currentBody.replace(capturedSelectedText, acceptedContent);
    } else if (currentMode === 'add' && currentBody != null) {
      editedContent = currentBody.trim()
        ? currentBody + '\n\n' + acceptedContent
        : acceptedContent;
    } else {
      editedContent = acceptedContent;
    }

    await ai.accept(requestId, {
      contentId,
      editedContent,
      changeDescription: currentMode === 'replace' ? 'AI-modified content' : 'AI-generated content',
    });

    // Update the local editor state.
    // For replace mode: pass the pre-computed full body so Library.tsx just calls setBody().
    if (currentMode === 'replace' && capturedSelectedText && currentBody != null) {
      // editedContent is the full body with replacement already applied
      onContentAccepted?.(editedContent!, 'replace' as const, undefined);
    } else {
      onContentAccepted?.(acceptedContent, currentMode as 'add' | 'replace', capturedSelectedText ?? undefined);
    }
    onSelectionCleared?.();
    ai.resetStream();
    await conv.refreshConversation();
    setCurrentPrompt(null);
    setCapturedSelectedText(null);
    setPromptSelectionLabel(null);
    setPromptImageCount(0);
  };

  const handleReject = async (requestId: string) => {
    await ai.reject(requestId);
    ai.resetStream();
    await conv.refreshConversation();
    setCurrentPrompt(null);
    setCapturedSelectedText(null);
    setPromptSelectionLabel(null);
    setPromptImageCount(0);
  };

  const handleCancel = async () => {
    if (ai.streamRequestId) {
      await ai.cancel(ai.streamRequestId);
    }
  };

  const handleDiscardStuck = async () => {
    // Force-discard all pending/generating requests for this branch (handles server errors / stuck state)
    if (branchId) {
      await aiApi.discardPending(branchId).catch(() => {});
    }
    ai.resetStream();
    if (branchId) await conv.refreshConversation();
    setCurrentPrompt(null);
    setCapturedSelectedText(null);
    setPromptSelectionLabel(null);
    setPromptImageCount(0);
  };

  const handleNewConversation = async () => {
    if (branchId) {
      // Discard any stale pending requests (handles server restart / stale state)
      await aiApi.discardPending(branchId).catch(() => {});
      await conv.clearConversation();
    }
    onSelectionCleared?.();
    ai.resetStream();
    setCurrentPrompt(null);
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: analysisOnly ? '100%' : 'var(--side-panel-width, 408px)',
        background: 'var(--color-background)',
        borderLeft: analysisOnly ? 'none' : '1px solid var(--gray-6)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--gray-12)' }}>AI Assistant</h3>
          {!analysisOnly && (
            <span className="text-xs" style={{ color: 'var(--gray-9)' }}>
              {conv.turnCount}/{conv.maxTurns}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {!analysisOnly && (
            <button
              onClick={handleNewConversation}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--gray-4)]"
              style={{ color: 'var(--gray-11)' }}
              title="Start new conversation"
            >
              <PlusIcon />
            </button>
          )}
          <button
            onClick={() => store.setPanelOpen(false)}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--gray-4)]"
            style={{ color: 'var(--gray-11)' }}
            title="Close panel"
          >
            <Cross2Icon />
          </button>
        </div>
      </div>

      {/* Gradient accent separator */}
      <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--accent-9), var(--accent-7), transparent)' }} />

      {/* Analysis mode banner */}
      {analysisOnly && (
        <div
          className="px-4 py-2 text-xs"
          style={{ background: 'var(--accent-2)', color: 'var(--accent-11)', borderBottom: '1px solid var(--accent-5)' }}
        >
          Analysis mode — ask questions about this content
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {/* Conversation history (exclude the request currently handled by local streaming state) */}
        {conv.conversation?.requests
          ?.filter((req) => req.id !== ai.streamRequestId)
          .map((req) => (
          <React.Fragment key={req.id}>
            <AIChatMessage
              role="user"
              content={req.responseMode && req.responseMode !== 'add'
                ? `/${req.responseMode} ${req.prompt}`
                : req.prompt}
              selectionContext={req.selectedText
                ? req.selectedText.slice(0, 80) + (req.selectedText.length > 80 ? '...' : '')
                : undefined}
            />
            {req.generatedContent && (
              <AIChatMessage
                role="assistant"
                content={req.generatedContent}
                status={req.status}
                onAccept={req.status === 'pending' ? () => handleAccept(req.id) : undefined}
                onReject={req.status === 'pending' ? () => handleReject(req.id) : undefined}
              />
            )}
            {/* Orphaned request — server errored before generating content */}
            {!req.generatedContent && (req.status === 'pending' || req.status === 'generating') && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{ background: 'var(--amber-3)', border: '1px solid var(--amber-6)' }}
              >
                <p style={{ color: 'var(--amber-11)' }}>This request did not complete.</p>
                <button
                  onClick={handleDiscardStuck}
                  className="mt-2 text-xs px-3 py-1.5 rounded-md transition-colors hover:opacity-80"
                  style={{ background: 'var(--gray-5)', color: 'var(--gray-12)' }}
                >
                  Discard
                </button>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* User prompt for current streaming/pending response */}
        {currentPrompt && (
          <AIChatMessage role="user" content={currentPrompt} selectionContext={promptSelectionLabel ?? undefined} imageCount={promptImageCount || undefined} />
        )}

        {/* Current streaming response */}
        {isStreaming && (
          <AIChatMessage role="assistant" content={ai.streamContent} isStreaming />
        )}

        {/* Completed stream waiting for accept/reject (not shown for analyse mode — auto-dismissed) */}
        {ai.streamStatus === 'complete' && ai.streamRequestId && currentMode !== 'analyse' && (
          <AIChatMessage
            role="assistant"
            content={ai.streamContent}
            status="pending"
            onAccept={() => handleAccept(ai.streamRequestId!)}
            onReject={() => handleReject(ai.streamRequestId!)}
          />
        )}

        {/* Stateless analysis response (analysisOnly mode — no requestId, read-only display) */}
        {ai.streamStatus === 'complete' && analysisOnly && !ai.streamRequestId && ai.streamContent && (
          <AIChatMessage role="assistant" content={ai.streamContent} />
        )}

        {/* Error display */}
        {ai.streamStatus === 'error' && ai.streamError && (
          <div className="text-sm rounded p-2" style={{ color: 'var(--red-11)', background: 'var(--red-3)' }}>
            {ai.streamError.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="px-3 pb-3 pt-2">
        {/* Turn limit warning (not applicable in analysisOnly mode) */}
        {!analysisOnly && !conv.hasRemainingTurns && (
          <div className="text-xs text-amber-600 mb-2">
            Turn limit reached. Start a new conversation to continue.
          </div>
        )}

        {/* Image thumbnails */}
        {attachedImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={img.preview}
                  alt={`Attachment ${i + 1}`}
                  className="w-14 h-14 object-cover rounded-lg border border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'var(--red-9)', fontSize: '10px' }}
                >
                  <Cross2Icon width={10} height={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selection indicator */}
        {selectionPreview && (
          <div
            className="flex items-center gap-2 text-xs mb-2 px-2 py-1.5 rounded"
            style={{ background: 'var(--accent-3)', color: 'var(--accent-11)', border: '1px solid var(--accent-6)' }}
          >
            <span className="font-medium shrink-0">Selection referenced</span>
            <span className="truncate" style={{ color: 'var(--accent-9)' }}>
              {selectionPreview}
            </span>
            <button
              type="button"
              onClick={() => { setSelectionPreview(null); onSelectionCleared?.(); }}
              className="shrink-0 ml-auto"
              style={{ color: 'var(--accent-9)' }}
            >
              <Cross2Icon width={12} height={12} />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
        <div
          className="ai-input-container flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{
            background: dragOver ? 'var(--accent-3)' : 'var(--gray-2)',
            border: dragOver ? '1px solid var(--accent-7)' : '1px solid var(--gray-5)',
            transition: 'background 150ms, border-color 150ms',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachedImages.length >= AI_DEFAULTS.MAX_IMAGES_PER_REQUEST}
            className="p-1.5 shrink-0 self-center transition-colors hover:bg-[var(--gray-4)] rounded disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'var(--gray-11)' }}
            title={attachedImages.length >= AI_DEFAULTS.MAX_IMAGES_PER_REQUEST ? `Max ${AI_DEFAULTS.MAX_IMAGES_PER_REQUEST} images` : 'Attach image'}
          >
            <ImageIcon width={18} height={18} />
          </button>
          <SlashCommandInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => {
              if (prompt.trim() && !isStreaming && !hasPending && (analysisOnly || conv.hasRemainingTurns)) {
                handleSubmit({ preventDefault: () => {} } as React.FormEvent);
              }
            }}
            onFocus={() => {
              // Check ProseMirror's selection (persists after editor blur, unlike
              // window.getSelection() which collapses when focus moves to this input)
              const selCtx = getSelectionContext?.();
              if (selCtx?.selectedText) {
                setSelectionPreview(selCtx.selectedText.slice(0, 120) + (selCtx.selectedText.length > 120 ? '...' : ''));
                // Apply highlight decoration immediately so it persists
                onSelectionReferenced?.();
              } else {
                setSelectionPreview(null);
              }
            }}
            placeholder={hasPending ? 'Resolve pending first...' : analysisOnly ? 'Ask about this content...' : 'Ask AI...'}
            disabled={hasPending || (!analysisOnly && !conv.hasRemainingTurns)}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-full shrink-0 transition-colors"
              style={{ background: 'var(--red-9)', color: 'white' }}
              title="Stop generating"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim() || hasPending || (!analysisOnly && !conv.hasRemainingTurns)}
              className="p-2 rounded-full shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: (!prompt.trim() || hasPending || (!analysisOnly && !conv.hasRemainingTurns)) ? 'var(--gray-5)' : 'var(--accent-9)',
                color: (!prompt.trim() || hasPending || (!analysisOnly && !conv.hasRemainingTurns)) ? 'var(--gray-9)' : 'var(--accent-contrast)',
              }}
              title="Send message"
            >
              <PaperPlaneIcon />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
