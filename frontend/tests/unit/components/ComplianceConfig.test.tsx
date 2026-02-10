import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock scrollIntoView (not available in jsdom)
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock @radix-ui/themes to avoid Theme context requirement
vi.mock('@radix-ui/themes', () => {
  const React = require('react');

  const SelectRoot = ({ children, value, onValueChange, disabled }: any) => {
    return React.createElement('div', { 'data-testid': 'select-root', 'data-value': value },
      children,
      // Render a native select for interaction testing
      React.createElement('select', {
        value,
        disabled,
        'data-testid': 'select-native',
        onChange: (e: any) => onValueChange?.(e.target.value),
      },
        React.createElement('option', { value: 'error' }, 'Error'),
        React.createElement('option', { value: 'warning' }, 'Warning'),
        React.createElement('option', { value: 'informational' }, 'Informational'),
      )
    );
  };

  const Select = Object.assign(SelectRoot, {
    Root: SelectRoot,
    Trigger: ({ children, ...props }: any) => React.createElement('button', { 'data-testid': 'select-trigger', ...props }, children),
    Content: ({ children }: any) => React.createElement('div', null, children),
    Item: ({ children, value }: any) => React.createElement('option', { value }, children),
  });

  return {
    Card: ({ children, ...props }: any) => React.createElement('div', props, children),
    Button: ({ children, onClick, disabled, variant, ...props }: any) =>
      React.createElement('button', { onClick, disabled, ...props }, children),
    Badge: ({ children, color, ...props }: any) =>
      React.createElement('span', { 'data-color': color, ...props }, children),
    TextField: {
      Root: (props: any) =>
        React.createElement('input', {
          type: props.type,
          value: props.value,
          onChange: props.onChange,
          disabled: props.disabled,
          min: props.min,
          max: props.max,
        }),
    },
    Text: ({ children, as: Tag = 'span', ...props }: any) =>
      React.createElement(Tag, props, children),
    Callout: {
      Root: ({ children, color }: any) =>
        React.createElement('div', { 'data-color': color, role: 'alert' }, children),
      Text: ({ children }: any) => React.createElement('span', null, children),
    },
    Heading: ({ children, as: Tag = 'h3', ...props }: any) =>
      React.createElement(Tag, props, children),
    Flex: ({ children, ...props }: any) => React.createElement('div', props, children),
    Switch: ({ checked, onCheckedChange, disabled }: any) =>
      React.createElement('button', {
        role: 'switch',
        'aria-checked': checked,
        onClick: () => !disabled && onCheckedChange?.(!checked),
        disabled,
      }),
    Box: ({ children, ...props }: any) => React.createElement('div', props, children),
    Separator: () => React.createElement('hr'),
    Select,
  };
});

// Mock the api service
vi.mock('../../../src/services/api', () => ({
  api: {
    get: vi.fn(),
  },
  apiFetch: vi.fn(),
}));

// Mock the ai-api service
vi.mock('../../../src/services/ai-api', () => ({
  aiApi: {
    getConfig: vi.fn(),
    updateComplianceConfig: vi.fn(),
  },
}));

import { AIConfigPanel } from '../../../src/components/ai/AIConfigPanel';
import { api } from '../../../src/services/api';
import { COMPLIANCE_CATEGORIES, COMPLIANCE_CATEGORY_LABELS } from '@echo-portal/shared';

const mockConfigResponse = {
  config: {
    global: {
      enabled: true,
      max_tokens: 4000,
      rate_limit: 50,
      max_turns: 20,
    },
    roles: {
      contributor: { enabled: true },
      reviewer: { enabled: true },
      administrator: { enabled: true },
    },
    compliance: {
      brand_adherence: { enabled: true, severity: 'warning' },
      accessibility: { enabled: true, severity: 'warning' },
      content_appropriateness: { enabled: true, severity: 'warning' },
      licensing_attribution: { enabled: true, severity: 'warning' },
      technical_quality: { enabled: true, severity: 'warning' },
    },
  },
};

describe('AIConfigPanel - Compliance Categories', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfigResponse);
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('renders all compliance category labels', async () => {
    render(<AIConfigPanel />);

    await waitFor(() => {
      for (const category of COMPLIANCE_CATEGORIES) {
        expect(screen.getByText(COMPLIANCE_CATEGORY_LABELS[category])).toBeInTheDocument();
      }
    });
  });

  it('renders "Compliance Categories" heading', async () => {
    render(<AIConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Categories')).toBeInTheDocument();
    });
  });

  it('loads compliance config from API on mount', async () => {
    render(<AIConfigPanel />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/ai/config');
    });
  });

  it('renders compliance config with default values when not in response', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      config: {
        global: { enabled: true },
        roles: {},
        // No compliance key
      },
    });

    render(<AIConfigPanel />);

    await waitFor(() => {
      for (const category of COMPLIANCE_CATEGORIES) {
        expect(screen.getByText(COMPLIANCE_CATEGORY_LABELS[category])).toBeInTheDocument();
      }
    });
  });

  it('includes compliance config in save payload', async () => {
    render(<AIConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Categories')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.compliance).toBeDefined();
      expect(body.compliance.brand_adherence).toEqual({ enabled: true, severity: 'warning' });
      expect(body.compliance.accessibility).toEqual({ enabled: true, severity: 'warning' });
    });
  });

  it('persists toggled category state in save payload', async () => {
    render(<AIConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Categories')).toBeInTheDocument();
    });

    // Find all switches - Global (1) + 3 roles (3) + 5 compliance (5) = 9
    const switches = screen.getAllByRole('switch');
    // Compliance switches start at index 4
    const brandSwitch = switches[4];
    fireEvent.click(brandSwitch);

    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.compliance.brand_adherence.enabled).toBe(false);
    });
  });

  it('shows success message after saving', async () => {
    render(<AIConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(screen.getByText('AI configuration saved successfully')).toBeInTheDocument();
    });
  });

  it('shows error message on save failure', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Save failed' } }),
    });

    render(<AIConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    (api.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<AIConfigPanel />);
    expect(screen.getByText('Loading AI configuration...')).toBeInTheDocument();
  });

  it('severity change updates config state for save', async () => {
    render(<AIConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Categories')).toBeInTheDocument();
    });

    // Find all native selects for severity
    const selects = screen.getAllByTestId('select-native');
    // Change first compliance category severity to 'error'
    fireEvent.change(selects[0], { target: { value: 'error' } });

    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.compliance.brand_adherence.severity).toBe('error');
    });
  });
});
