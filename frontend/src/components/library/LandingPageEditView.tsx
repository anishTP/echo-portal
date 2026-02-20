import { useRef, useCallback, useState } from 'react';
import { Button } from '@radix-ui/themes';
import { InlineEditor, type InlineEditorHandle } from '../editor/InlineEditor';

export interface LandingPageEditViewProps {
  initialBody: string;
  title: string;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
}

export function LandingPageEditView({
  initialBody,
  title,
  onSave,
  onCancel,
}: LandingPageEditViewProps) {
  const editorRef = useRef<InlineEditorHandle | null>(null);
  const bodyRef = useRef(initialBody);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = useCallback((markdown: string) => {
    bodyRef.current = markdown;
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(bodyRef.current);
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-5)', fontWeight: 600 }}>
          Editing: {title}
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="soft" color="gray" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
      <div style={{
        border: '1px solid var(--gray-a5)',
        borderRadius: 'var(--radius-3)',
        padding: 'var(--space-4)',
        minHeight: 300,
      }}>
        <InlineEditor
          defaultValue={initialBody}
          onChange={handleChange}
          editorRef={editorRef}
          placeholder="Write an overview for this page..."
        />
      </div>
    </div>
  );
}
