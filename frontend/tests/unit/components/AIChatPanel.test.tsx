import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock all external dependencies before importing the component
vi.mock('../../../src/hooks/useAIAssist', () => ({
  useAIAssist: vi.fn().mockReturnValue({
    generate: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
    cancel: vi.fn(),
    resetStream: vi.fn(),
    streamContent: '',
    streamStatus: 'idle',
    streamRequestId: null,
  }),
}));

vi.mock('../../../src/hooks/useAIConversation', () => ({
  useAIConversation: vi.fn().mockReturnValue({
    conversation: null,
    conversationId: null,
    turnCount: 0,
    maxTurns: 20,
    refreshConversation: vi.fn(),
    clearConversation: vi.fn(),
  }),
}));

vi.mock('../../../src/stores/aiStore', () => ({
  useAIStore: vi.fn().mockReturnValue({
    panelOpen: true,
    setPanelOpen: vi.fn(),
    streamingStatus: 'idle',
    pendingRequest: null,
  }),
}));

vi.mock('../../../src/services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ config: { global: { enabled: true } } }),
  },
}));

vi.mock('../../../src/components/ai/AIChatMessage', () => ({
  AIChatMessage: ({ role, content }: any) => (
    <div data-testid="chat-message" data-role={role}>{content}</div>
  ),
}));

vi.mock('../../../src/components/ai/SlashCommandInput', () => ({
  SlashCommandInput: ({ placeholder, disabled, onFocus }: any) => (
    <div
      role="textbox"
      data-placeholder={placeholder}
      data-disabled={disabled}
      onFocus={onFocus}
    />
  ),
}));

import { AIChatPanel } from '../../../src/components/ai/AIChatPanel';
import { useAIStore } from '../../../src/stores/aiStore';

describe('AIChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when panel is closed', () => {
    (useAIStore as any).mockReturnValue({
      panelOpen: false,
      setPanelOpen: vi.fn(),
      streamingStatus: 'idle',
      pendingRequest: null,
    });

    const { container } = render(<AIChatPanel branchId="branch-1" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the panel header when open', () => {
    (useAIStore as any).mockReturnValue({
      panelOpen: true,
      setPanelOpen: vi.fn(),
      streamingStatus: 'idle',
      pendingRequest: null,
    });

    render(<AIChatPanel branchId="branch-1" />);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('shows turn counter', () => {
    (useAIStore as any).mockReturnValue({
      panelOpen: true,
      setPanelOpen: vi.fn(),
      streamingStatus: 'idle',
      pendingRequest: null,
    });

    render(<AIChatPanel branchId="branch-1" />);
    expect(screen.getByText('0/20')).toBeInTheDocument();
  });

  it('shows prompt input', () => {
    (useAIStore as any).mockReturnValue({
      panelOpen: true,
      setPanelOpen: vi.fn(),
      streamingStatus: 'idle',
      pendingRequest: null,
    });

    render(<AIChatPanel branchId="branch-1" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
