import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the useNotifications hook — no outer-scope references inside factory (hoisted)
vi.mock('../../../src/hooks/useNotifications', () => ({
  useUnreadCount: vi.fn(),
}));

// Mock Radix components
vi.mock('@radix-ui/themes', () => ({
  IconButton: ({ children, onClick, 'aria-label': ariaLabel, ...props }: any) => (
    <button onClick={onClick} aria-label={ariaLabel} data-testid="icon-button" {...props}>
      {children}
    </button>
  ),
}));

import { NotificationBell } from '../../../src/components/notification/NotificationBell';
import { useUnreadCount } from '../../../src/hooks/useNotifications';

const mockUseUnreadCount = vi.mocked(useUnreadCount);

function setUnreadCount(count: number) {
  mockUseUnreadCount.mockReturnValue({ data: { count } } as any);
}

function setDataUndefined() {
  mockUseUnreadCount.mockReturnValue({ data: undefined } as any);
}

describe('NotificationBell', () => {
  describe('badge count display', () => {
    it('renders exact count for values 1 through 99', () => {
      for (const count of [1, 5, 42, 99]) {
        setUnreadCount(count);
        const { unmount } = render(<NotificationBell />);
        expect(screen.getByText(String(count))).toBeInTheDocument();
        unmount();
      }
    });

    it('renders "99+" when count is 100 or more', () => {
      for (const count of [100, 150, 999]) {
        setUnreadCount(count);
        const { unmount } = render(<NotificationBell />);
        expect(screen.getByText('99+')).toBeInTheDocument();
        expect(screen.queryByText(String(count))).not.toBeInTheDocument();
        unmount();
      }
    });

    it('does not render badge when count is 0', () => {
      setUnreadCount(0);
      render(<NotificationBell />);
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      // Ensure no badge span is present
      const button = screen.getByTestId('icon-button');
      const container = button.parentElement!;
      const badge = container.querySelector('.bg-red-500');
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe('aria-label', () => {
    it('includes unread count when count is greater than 0', () => {
      setUnreadCount(5);
      render(<NotificationBell />);
      expect(screen.getByLabelText('Notifications (5 unread)')).toBeInTheDocument();
    });

    it('excludes count when count is 0', () => {
      setUnreadCount(0);
      render(<NotificationBell />);
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
      expect(screen.queryByLabelText(/unread/)).not.toBeInTheDocument();
    });
  });

  describe('onClick handler', () => {
    it('fires when the bell button is clicked', () => {
      setUnreadCount(0);
      const handleClick = vi.fn();
      render(<NotificationBell onClick={handleClick} />);
      fireEvent.click(screen.getByTestId('icon-button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading state', () => {
    it('handles undefined data gracefully (no badge, default aria-label)', () => {
      setDataUndefined();
      render(<NotificationBell />);
      // No badge should be visible
      const button = screen.getByTestId('icon-button');
      const container = button.parentElement!;
      const badge = container.querySelector('.bg-red-500');
      expect(badge).not.toBeInTheDocument();
      // aria-label should be the zero-count variant
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });
  });
});
