interface AIStreamDisplayProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

/**
 * AIStreamDisplay — renders streaming markdown text with cursor indicator
 *
 * Shows accumulated text as it streams in, with a blinking cursor at the end
 * while streaming is active.
 */
export function AIStreamDisplay({ content, isStreaming, className = '' }: AIStreamDisplayProps) {
  if (!content && !isStreaming) return null;

  return (
    <div className={`ai-stream-display ${className}`}>
      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
        {content}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" aria-hidden="true" />
        )}
      </div>
      {!content && isStreaming && (
        <div className="text-muted-foreground text-sm italic">Generating...</div>
      )}
    </div>
  );
}
