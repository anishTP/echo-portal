import { Button, Separator } from '@radix-ui/themes';
import {
  FontBoldIcon,
  FontItalicIcon,
  StrikethroughIcon,
  CodeIcon,
  Link2Icon,
  ListBulletIcon,
  QuoteIcon,
} from '@radix-ui/react-icons';

export interface EditorToolbarProps {
  onBold?: () => void;
  onItalic?: () => void;
  onStrikethrough?: () => void;
  onCode?: () => void;
  onLink?: () => void;
  onBulletList?: () => void;
  onOrderedList?: () => void;
  onBlockquote?: () => void;
  onHeading?: (level: 1 | 2 | 3) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Formatting toolbar for the inline editor.
 * Provides buttons for common markdown formatting operations.
 */
export function EditorToolbar({
  onBold,
  onItalic,
  onStrikethrough,
  onCode,
  onLink,
  onBulletList,
  onBlockquote,
  onHeading,
  disabled = false,
  className = '',
}: EditorToolbarProps) {
  return (
    <div className={`editor-toolbar ${className}`} role="toolbar" aria-label="Text formatting">
      <div className="editor-toolbar-group">
        <Button
          variant="ghost"
          size="1"
          onClick={onBold}
          disabled={disabled}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
        >
          <FontBoldIcon />
        </Button>
        <Button
          variant="ghost"
          size="1"
          onClick={onItalic}
          disabled={disabled}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          <FontItalicIcon />
        </Button>
        <Button
          variant="ghost"
          size="1"
          onClick={onStrikethrough}
          disabled={disabled}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <StrikethroughIcon />
        </Button>
        <Button
          variant="ghost"
          size="1"
          onClick={onCode}
          disabled={disabled}
          title="Inline code"
          aria-label="Inline code"
        >
          <CodeIcon />
        </Button>
      </div>

      <Separator orientation="vertical" size="1" />

      <div className="editor-toolbar-group">
        <Button
          variant="ghost"
          size="1"
          onClick={() => onHeading?.(1)}
          disabled={disabled}
          title="Heading 1"
          aria-label="Heading 1"
        >
          H1
        </Button>
        <Button
          variant="ghost"
          size="1"
          onClick={() => onHeading?.(2)}
          disabled={disabled}
          title="Heading 2"
          aria-label="Heading 2"
        >
          H2
        </Button>
        <Button
          variant="ghost"
          size="1"
          onClick={() => onHeading?.(3)}
          disabled={disabled}
          title="Heading 3"
          aria-label="Heading 3"
        >
          H3
        </Button>
      </div>

      <Separator orientation="vertical" size="1" />

      <div className="editor-toolbar-group">
        <Button
          variant="ghost"
          size="1"
          onClick={onBulletList}
          disabled={disabled}
          title="Bullet list"
          aria-label="Bullet list"
        >
          <ListBulletIcon />
        </Button>
        <Button
          variant="ghost"
          size="1"
          onClick={onBlockquote}
          disabled={disabled}
          title="Blockquote"
          aria-label="Blockquote"
        >
          <QuoteIcon />
        </Button>
        <Button
          variant="ghost"
          size="1"
          onClick={onLink}
          disabled={disabled}
          title="Insert link"
          aria-label="Insert link"
        >
          <Link2Icon />
        </Button>
      </div>
    </div>
  );
}

export default EditorToolbar;
