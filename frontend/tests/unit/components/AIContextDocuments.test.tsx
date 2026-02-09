import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Mock scrollIntoView (not available in jsdom)
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock the AI API service
vi.mock('../../../src/services/ai-api', () => ({
  aiApi: {
    getContextDocuments: vi.fn(),
    createContextDocument: vi.fn(),
    updateContextDocument: vi.fn(),
    deleteContextDocument: vi.fn(),
  },
}));

import { AIContextDocuments } from '../../../src/components/ai/AIContextDocuments';
import { aiApi } from '../../../src/services/ai-api';

const mockDocs = [
  {
    id: '00000000-0000-4000-8000-000000000100',
    title: 'Brand Guidelines',
    content: 'Always use professional tone.',
    enabled: true,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Tone of Voice',
    content: 'Friendly but authoritative.',
    enabled: false,
    sortOrder: 1,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

describe('AIContextDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolve with mock docs
    (aiApi.getContextDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(mockDocs);
    (aiApi.createContextDocument as ReturnType<typeof vi.fn>).mockResolvedValue(mockDocs[0]);
    (aiApi.updateContextDocument as ReturnType<typeof vi.fn>).mockResolvedValue(mockDocs[0]);
    (aiApi.deleteContextDocument as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  });

  it('renders loading state initially', () => {
    // Never-resolving promise so it stays in loading state
    (aiApi.getContextDocuments as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<AIContextDocuments />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders documents after loading', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    expect(screen.getByText('Tone of Voice')).toBeInTheDocument();
    expect(screen.getByText(/Always use professional tone\./)).toBeInTheDocument();
    expect(screen.getByText(/Friendly but authoritative\./)).toBeInTheDocument();
  });

  it('shows empty state when no documents', async () => {
    (aiApi.getContextDocuments as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('No context documents yet.')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Add brand guidelines, tone-of-voice docs, or style guides for the AI to reference.')
    ).toBeInTheDocument();
  });

  it('"Add Document" button shows the form', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Document'));

    expect(screen.getByText('New Context Document')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Brand Guidelines')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter document content in markdown...')).toBeInTheDocument();
  });

  it('Save button calls createContextDocument and refreshes', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Document'));

    const titleInput = screen.getByPlaceholderText('e.g. Brand Guidelines');
    const contentTextarea = screen.getByPlaceholderText('Enter document content in markdown...');

    fireEvent.change(titleInput, { target: { value: 'New Style Guide' } });
    fireEvent.change(contentTextarea, { target: { value: 'Content here.' } });

    // Clear call count from initial load
    (aiApi.getContextDocuments as ReturnType<typeof vi.fn>).mockClear();
    (aiApi.getContextDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(mockDocs);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(aiApi.createContextDocument).toHaveBeenCalledWith({
        title: 'New Style Guide',
        content: 'Content here.',
        sortOrder: 0,
      });
    });

    // After save, fetchDocs is called again to refresh
    await waitFor(() => {
      expect(aiApi.getContextDocuments).toHaveBeenCalled();
    });
  });

  it('Edit button shows form with pre-filled data', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Edit Context Document')).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue('Brand Guidelines');
    expect(titleInput).toBeInTheDocument();

    const contentTextarea = screen.getByDisplayValue('Always use professional tone.');
    expect(contentTextarea).toBeInTheDocument();
  });

  it('Toggle calls updateContextDocument with enabled toggled', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    // First doc is enabled=true, toggle should call with enabled=false
    const toggleButtons = screen.getAllByTitle('Disable');
    fireEvent.click(toggleButtons[0]);

    await waitFor(() => {
      expect(aiApi.updateContextDocument).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000100',
        { enabled: false }
      );
    });
  });

  it('Toggle calls updateContextDocument to enable a disabled doc', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Tone of Voice')).toBeInTheDocument();
    });

    // Second doc is enabled=false, toggle button should have title "Enable"
    const enableButton = screen.getByTitle('Enable');
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(aiApi.updateContextDocument).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000101',
        { enabled: true }
      );
    });
  });

  it('Delete calls deleteContextDocument', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(aiApi.deleteContextDocument).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000100'
      );
    });
  });

  it('shows error message on API failure', async () => {
    (aiApi.getContextDocuments as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Dismiss button should be present
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('dismisses error when Dismiss is clicked', async () => {
    (aiApi.getContextDocuments as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Dismiss'));

    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
  });

  it('Cancel button hides the form', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Document'));
    expect(screen.getByText('New Context Document')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('New Context Document')).not.toBeInTheDocument();
  });

  it('shows error when save fails', async () => {
    (aiApi.createContextDocument as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Failed to save')
    );

    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Document'));

    const titleInput = screen.getByPlaceholderText('e.g. Brand Guidelines');
    const contentTextarea = screen.getByPlaceholderText('Enter document content in markdown...');

    fireEvent.change(titleInput, { target: { value: 'Test Doc' } });
    fireEvent.change(contentTextarea, { target: { value: 'Test content.' } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeInTheDocument();
    });
  });

  it('renders the header and description', async () => {
    render(<AIContextDocuments />);

    expect(screen.getByText('Context Documents')).toBeInTheDocument();
    expect(
      screen.getByText('Reference materials injected into AI prompts (brand guidelines, tone of voice, etc.)')
    ).toBeInTheDocument();
  });

  it('disables Add Document button while editing', async () => {
    render(<AIContextDocuments />);

    await waitFor(() => {
      expect(screen.getByText('Brand Guidelines')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Document'));

    expect(screen.getByText('Add Document').closest('button')).toBeDisabled();
  });
});
