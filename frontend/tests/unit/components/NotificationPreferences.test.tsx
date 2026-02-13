import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the useNotifications hooks — no outer-scope references inside factory (hoisted)
vi.mock('../../../src/hooks/useNotifications', () => ({
  useNotificationPreferences: vi.fn(),
  useUpdatePreference: vi.fn(),
}));

// Mock Radix components
vi.mock('@radix-ui/themes', () => ({
  Switch: ({ checked, disabled, onCheckedChange, ...props }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-testid={`switch-${props['data-category'] ?? ''}`}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
  Text: ({ children, as: Tag = 'span', ...props }: any) => {
    const Element = Tag as any;
    return <Element {...props}>{children}</Element>;
  },
}));

import { NotificationPreferences } from '../../../src/components/notification/NotificationPreferences';
import { useNotificationPreferences, useUpdatePreference } from '../../../src/hooks/useNotifications';

const mockUseNotificationPreferences = vi.mocked(useNotificationPreferences);
const mockUseUpdatePreference = vi.mocked(useUpdatePreference);

const ALL_PREFERENCES = [
  { category: 'review', enabled: true },
  { category: 'lifecycle', enabled: true },
  { category: 'ai', enabled: false },
];

const mockMutate = vi.fn();

function setupMocks(overrides?: {
  preferences?: typeof ALL_PREFERENCES | undefined;
  isLoading?: boolean;
  isPending?: boolean;
}) {
  const opts = overrides ?? {};
  const preferences = 'preferences' in opts ? opts.preferences : ALL_PREFERENCES;
  const isLoading = opts.isLoading ?? false;
  const isPending = opts.isPending ?? false;

  mockUseNotificationPreferences.mockReturnValue({
    data: preferences,
    isLoading,
  } as any);

  mockUseUpdatePreference.mockReturnValue({
    mutate: mockMutate,
    isPending,
  } as any);
}

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders categories', () => {
    it('renders all 3 categories with correct labels', () => {
      setupMocks();
      render(<NotificationPreferences />);

      expect(screen.getByText('Review Events')).toBeInTheDocument();
      expect(screen.getByText('Lifecycle Events')).toBeInTheDocument();
      expect(screen.getByText('AI Events')).toBeInTheDocument();
    });

    it('renders description text for each category', () => {
      setupMocks();
      render(<NotificationPreferences />);

      expect(
        screen.getByText(/Notifications about review requests, comments, approvals/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Notifications when you are added\/removed as a collaborator/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Notifications when AI compliance analysis detects issues/)
      ).toBeInTheDocument();
    });
  });

  describe('enabled/disabled state', () => {
    it('shows correct enabled state for each switch', () => {
      setupMocks({
        preferences: [
          { category: 'review', enabled: true },
          { category: 'lifecycle', enabled: false },
          { category: 'ai', enabled: true },
        ],
      });
      render(<NotificationPreferences />);

      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(3);

      // review: enabled
      expect(switches[0]).toHaveAttribute('aria-checked', 'true');
      // lifecycle: disabled
      expect(switches[1]).toHaveAttribute('aria-checked', 'false');
      // ai: enabled
      expect(switches[2]).toHaveAttribute('aria-checked', 'true');
    });

    it('shows all switches as enabled when all preferences are enabled', () => {
      setupMocks({
        preferences: [
          { category: 'review', enabled: true },
          { category: 'lifecycle', enabled: true },
          { category: 'ai', enabled: true },
        ],
      });
      render(<NotificationPreferences />);

      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => {
        expect(sw).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('shows all switches as disabled when all preferences are disabled', () => {
      setupMocks({
        preferences: [
          { category: 'review', enabled: false },
          { category: 'lifecycle', enabled: false },
          { category: 'ai', enabled: false },
        ],
      });
      render(<NotificationPreferences />);

      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => {
        expect(sw).toHaveAttribute('aria-checked', 'false');
      });
    });
  });

  describe('toggle behavior', () => {
    it('calls mutate with correct category and enabled=false when toggling off a review switch', () => {
      setupMocks({
        preferences: [
          { category: 'review', enabled: true },
          { category: 'lifecycle', enabled: true },
          { category: 'ai', enabled: false },
        ],
      });
      render(<NotificationPreferences />);

      const switches = screen.getAllByRole('switch');
      // Click the first switch (review, currently enabled -> should toggle to false)
      fireEvent.click(switches[0]);

      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith({ category: 'review', enabled: false });
    });

    it('calls mutate with correct category and enabled=true when toggling on an ai switch', () => {
      setupMocks({
        preferences: [
          { category: 'review', enabled: true },
          { category: 'lifecycle', enabled: true },
          { category: 'ai', enabled: false },
        ],
      });
      render(<NotificationPreferences />);

      const switches = screen.getAllByRole('switch');
      // Click the third switch (ai, currently disabled -> should toggle to true)
      fireEvent.click(switches[2]);

      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith({ category: 'ai', enabled: true });
    });

    it('calls mutate with lifecycle category when toggling the lifecycle switch', () => {
      setupMocks({
        preferences: [
          { category: 'review', enabled: true },
          { category: 'lifecycle', enabled: true },
          { category: 'ai', enabled: false },
        ],
      });
      render(<NotificationPreferences />);

      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[1]);

      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith({ category: 'lifecycle', enabled: false });
    });

    it('disables all switches while mutation is pending', () => {
      setupMocks({ isPending: true });
      render(<NotificationPreferences />);

      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => {
        expect(sw).toBeDisabled();
      });
    });

    it('does not disable switches when mutation is not pending', () => {
      setupMocks({ isPending: false });
      render(<NotificationPreferences />);

      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => {
        expect(sw).not.toBeDisabled();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading text when isLoading is true', () => {
      setupMocks({ isLoading: true });
      render(<NotificationPreferences />);

      expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
    });

    it('does not render any category labels when loading', () => {
      setupMocks({ isLoading: true });
      render(<NotificationPreferences />);

      expect(screen.queryByText('Review Events')).not.toBeInTheDocument();
      expect(screen.queryByText('Lifecycle Events')).not.toBeInTheDocument();
      expect(screen.queryByText('AI Events')).not.toBeInTheDocument();
    });

    it('does not render any switches when loading', () => {
      setupMocks({ isLoading: true });
      render(<NotificationPreferences />);

      expect(screen.queryAllByRole('switch')).toHaveLength(0);
    });
  });

  describe('empty/undefined preferences', () => {
    it('renders empty container when preferences is undefined', () => {
      setupMocks({ preferences: undefined });
      render(<NotificationPreferences />);

      expect(screen.queryByText('Review Events')).not.toBeInTheDocument();
      expect(screen.queryByText('Lifecycle Events')).not.toBeInTheDocument();
      expect(screen.queryByText('AI Events')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('switch')).toHaveLength(0);
    });

    it('renders empty container when preferences is an empty array', () => {
      setupMocks({ preferences: [] });
      render(<NotificationPreferences />);

      expect(screen.queryByText('Review Events')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('switch')).toHaveLength(0);
    });

    it('skips unknown categories not in CATEGORY_INFO', () => {
      setupMocks({
        preferences: [
          { category: 'review', enabled: true },
          { category: 'unknown_category', enabled: true },
          { category: 'ai', enabled: false },
        ] as any,
      });
      render(<NotificationPreferences />);

      // Only 2 known categories should render
      expect(screen.getByText('Review Events')).toBeInTheDocument();
      expect(screen.getByText('AI Events')).toBeInTheDocument();
      expect(screen.getAllByRole('switch')).toHaveLength(2);
    });
  });
});
