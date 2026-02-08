import React, { useState, useRef, useEffect } from 'react';
import { AIChatMessage } from './AIChatMessage.js';
import { useAIAssist } from '../../hooks/useAIAssist.js';
import { useAIConversation } from '../../hooks/useAIConversation.js';
import { useAIStore } from '../../stores/aiStore.js';
import { api } from '../../services/api.js';
import { aiApi } from '../../services/ai-api.js';

interface AIChatPanelProps {
  branchId: string;
  contentId?: string;
  onContentAccepted?: (content: string) => void;
}

/**
 * AIChatPanel — collapsible side panel with conversation UI (FR-014)
 *
 * Provides chat interface for content generation with multi-turn
 * conversation, streaming display, and accept/reject actions.
 * Checks AI enabled state from config (T044).
 */
export function AIChatPanel({ branchId, contentId, onContentAccepted }: AIChatPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [aiEnabled, setAIEnabled] = useState(true);
  const [configChecked, setConfigChecked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const store = useAIStore();
  const ai = useAIAssist();
  const conv = useAIConversation(branchId);

  const isStreaming = ai.streamStatus === 'streaming';
  const hasPending = store.streamingStatus === 'streaming' || store.pendingRequest !== null;

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

  if (!store.panelOpen) return null;

  // Show disabled state when AI is off
  if (configChecked && !aiEnabled) {
    return (
      <div
        className="flex flex-col h-full w-96"
        style={{ background: 'var(--color-background)', borderLeft: '1px solid var(--gray-6)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--gray-6)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--gray-12)' }}>AI Assistant</h3>
          <button
            onClick={() => store.setPanelOpen(false)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--gray-11)' }}
            title="Close panel"
          >
            ✕
          </button>
        </div>
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
    if (!prompt.trim() || isStreaming || hasPending) return;

    const currentPrompt = prompt;
    setPrompt('');

    await ai.generate({
      branchId,
      contentId,
      prompt: currentPrompt,
      conversationId: conv.conversationId ?? undefined,
    });

    // Refresh conversation to get updated state
    await conv.refreshConversation();
  };

  const handleAccept = async (requestId: string) => {
    if (!contentId) return;
    // Strip code fences and conversational preamble/postamble from AI output
    let acceptedContent = ai.streamContent;
    const fenceMatch = acceptedContent.match(/```(?:markdown|md)?\n([\s\S]*?)```/);
    if (fenceMatch) {
      acceptedContent = fenceMatch[1].trim();
    }
    await ai.accept(requestId, {
      contentId,
      changeDescription: 'AI-generated content',
    });
    onContentAccepted?.(acceptedContent);
    ai.resetStream();
    await conv.refreshConversation();
  };

  const handleReject = async (requestId: string) => {
    await ai.reject(requestId);
    ai.resetStream();
    await conv.refreshConversation();
  };

  const handleCancel = async () => {
    if (ai.streamRequestId) {
      await ai.cancel(ai.streamRequestId);
    }
  };

  const handleNewConversation = async () => {
    // Discard any stale pending requests (handles server restart / stale state)
    await aiApi.discardPending(branchId).catch(() => {});
    await conv.clearConversation();
    ai.resetStream();
  };

  return (
    <div
      className="flex flex-col h-full w-96"
      style={{
        background: 'var(--color-background)',
        borderLeft: '1px solid var(--gray-6)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--gray-6)' }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--gray-12)' }}>AI Assistant</h3>
          <span className="text-xs" style={{ color: 'var(--gray-9)' }}>
            {conv.turnCount}/{conv.maxTurns} turns
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleNewConversation}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--gray-11)' }}
            title="Start new conversation"
          >
            New
          </button>
          <button
            onClick={() => store.setPanelOpen(false)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--gray-11)' }}
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Conversation history */}
        {conv.conversation?.requests?.map((req) => (
          <React.Fragment key={req.id}>
            <AIChatMessage role="user" content={req.prompt} />
            {req.generatedContent && (
              <AIChatMessage
                role="assistant"
                content={req.generatedContent}
                status={req.status}
                onAccept={req.status === 'pending' ? () => handleAccept(req.id) : undefined}
                onReject={req.status === 'pending' ? () => handleReject(req.id) : undefined}
              />
            )}
          </React.Fragment>
        ))}

        {/* Current streaming response */}
        {isStreaming && (
          <AIChatMessage role="assistant" content={ai.streamContent} isStreaming />
        )}

        {/* Completed stream waiting for accept/reject */}
        {ai.streamStatus === 'complete' && ai.streamRequestId && (
          <AIChatMessage
            role="assistant"
            content={ai.streamContent}
            status="pending"
            onAccept={() => handleAccept(ai.streamRequestId!)}
            onReject={() => handleReject(ai.streamRequestId!)}
          />
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
      <form onSubmit={handleSubmit} className="p-4" style={{ borderTop: '1px solid var(--gray-6)' }}>
        {/* Turn limit warning */}
        {!conv.hasRemainingTurns && (
          <div className="text-xs text-amber-600 mb-2">
            Turn limit reached. Start a new conversation to continue.
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={hasPending ? 'Resolve pending content first...' : 'Ask AI to generate content...'}
            disabled={hasPending || !conv.hasRemainingTurns}
            className="flex-1 resize-none rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--gray-6)',
              color: 'var(--gray-12)',
            }}
            rows={2}
          />
          <div className="flex flex-col gap-1">
            <button
              type="submit"
              disabled={!prompt.trim() || hasPending || !conv.hasRemainingTurns}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
            {isStreaming && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
