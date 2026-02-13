import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock Radix Popover with functional open/close behavior.
// The NotificationPopover component uses controlled state: it passes open={open}
// and onOpenChange={setOpen} to Popover.Root. Toggle is handled by NotificationBell's
// onClick calling setOpen(prev => !prev), so the mock Trigger must NOT add its own
// click handler (that would cause a double-toggle via event bubbling).
vi.mock('@radix-ui/react-popover', () => {
  const React = require('react');

  function Root({ open, children }: any) {
    return React.createElement(
      'div',
      { 'data-testid': 'popover-root', 'data-open': String(!!open) },
      React.Children.map(children, (child: any) => {
        if (!child) return null;
        if (child.type?.__popoverRole === 'portal') {
          return React.cloneElement(child, { __open: !!open });
        }
        return child;
      })
    );
  }

  function Trigger({ children, asChild }: any) {
    return React.createElement(
      'div',
      { 'data-testid': 'popover-trigger' },
      children
    );
  }
  Trigger.__popoverRole = 'trigger';

  function Portal({ children, __open }: any) {
    if (!__open) return null;
    return React.createElement('div', { 'data-testid': 'popover-portal' }, children);
  }
  Portal.__popoverRole = 'portal';

  function Content({ children, className, sideOffset, align, ...props }: any) {
    return React.createElement(
      'div',
      {
        'data-testid': 'popover-content',
        'data-side-offset': sideOffset,
        'data-align': align,
        className,
        ...props,
      },
      children
    );
  }

  return { Root, Trigger, Portal, Content };
});

// Mock NotificationBell
vi.mock('../../../src/components/notification/NotificationBell', () => ({
  NotificationBell: ({ onClick }: { onClick?: () => void }) => (
    <button data-testid="notification-bell" onClick={onClick}>
      Bell
    </button>
  ),
}));

// Mock NotificationList - capture props for assertion
vi.mock('../../../src/components/notification/NotificationList', () => ({
  NotificationList: ({ mode, maxItems, onClose }: { mode?: string; maxItems?: number; onClose?: () => void }) => (
    <div
      data-testid="notification-list"
      data-mode={mode}
      data-max-items={maxItems}
    >
      <button data-testid="close-button" onClick={onClose}>
        Close
      </button>
      Notification List Content
    </div>
  ),
}));

import { NotificationPopover } from '../../../src/components/notification/NotificationPopover';

describe('NotificationPopover', () => {
  it('renders NotificationBell', () => {
    render(<NotificationPopover />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('does not show list content when popover is closed', () => {
    render(<NotificationPopover />);
    expect(screen.queryByTestId('notification-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('popover-portal')).not.toBeInTheDocument();
  });

  it('opens popover on bell click', () => {
    render(<NotificationPopover />);

    const bell = screen.getByTestId('notification-bell');
    act(() => {
      fireEvent.click(bell);
    });

    expect(screen.getByTestId('popover-portal')).toBeInTheDocument();
    expect(screen.getByTestId('notification-list')).toBeInTheDocument();
  });

  it('passes mode="popover" and maxItems={5} to NotificationList', () => {
    render(<NotificationPopover />);

    // Open the popover first
    const bell = screen.getByTestId('notification-bell');
    act(() => {
      fireEvent.click(bell);
    });

    const list = screen.getByTestId('notification-list');
    expect(list).toHaveAttribute('data-mode', 'popover');
    expect(list).toHaveAttribute('data-max-items', '5');
  });

  it('closes popover when onClose callback is invoked', () => {
    render(<NotificationPopover />);

    // Open the popover
    const bell = screen.getByTestId('notification-bell');
    act(() => {
      fireEvent.click(bell);
    });

    expect(screen.getByTestId('notification-list')).toBeInTheDocument();

    // Click the close button inside NotificationList mock
    const closeButton = screen.getByTestId('close-button');
    act(() => {
      fireEvent.click(closeButton);
    });

    expect(screen.queryByTestId('notification-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('popover-portal')).not.toBeInTheDocument();
  });
});
