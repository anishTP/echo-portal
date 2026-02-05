/**
 * DiffMarkdownRenderer - Renders markdown with paragraph-level diff annotations.
 * Used in unified view to display full article with highlighted changes.
 */

import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import type { DiffHunk } from '@echo-portal/shared';
import { buildLineDiffMap, getLineDiffType } from '../../utils/diffLineMapping';
import { VideoEmbed, detectVideoType } from '../editor/VideoEmbed';
import styles from './FullArticleDiffView.module.css';

interface DiffMarkdownRendererProps {
  content: string;
  hunks: DiffHunk[];
  side: 'old' | 'new';
}

/**
 * Renders markdown body with inline diff highlighting.
 * Changed paragraphs/blocks get colored backgrounds.
 */
export function DiffMarkdownRenderer({
  content,
  hunks,
  side,
}: DiffMarkdownRendererProps) {
  // Build line maps from hunks
  const diffMaps = buildLineDiffMap(hunks);

  // Split content into lines for line-level tracking
  const lines = content.split('\n');

  // Track current line position as we render
  const currentLine = 1;

  /**
   * Check if a text block (paragraph, heading, etc.) has changes.
   * Counts lines in the rendered text to match against diff hunks.
   */
  const getBlockDiffType = (
    text: string
  ): 'context' | 'addition' | 'deletion' | 'mixed' => {
    // Find this text in the lines array to get line numbers
    const textLines = text.split('\n');
    let hasAdditions = false;
    let hasDeletions = false;

    // Search for the first line of this text in our lines
    const firstLineIdx = lines.findIndex(
      (l, idx) => idx >= currentLine - 1 && l.includes(textLines[0].trim())
    );

    if (firstLineIdx >= 0) {
      const startLine = firstLineIdx + 1;
      for (let i = 0; i < textLines.length; i++) {
        const lineNum = startLine + i;
        const type = getLineDiffType(lineNum, side, diffMaps);
        if (type === 'addition') hasAdditions = true;
        if (type === 'deletion') hasDeletions = true;
      }
    }

    if (hasAdditions && hasDeletions) return 'mixed';
    if (hasAdditions) return 'addition';
    if (hasDeletions) return 'deletion';
    return 'context';
  };

  /**
   * Wrap content in a diff-highlighted container based on type.
   */
  const wrapWithDiffStyle = (
    children: React.ReactNode,
    text: string
  ): React.ReactNode => {
    const diffType = getBlockDiffType(String(text));

    if (diffType === 'context') {
      return children;
    }

    const className =
      diffType === 'deletion'
        ? styles.blockDeletion
        : diffType === 'addition'
          ? styles.blockAddition
          : styles.blockMixed;

    return <div className={className}>{children}</div>;
  };

  // Custom heading renderer
  const HeadingRenderer = ({
    level,
    children,
  }: {
    level: number;
    children: React.ReactNode;
  }) => {
    const text = String(children);
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    const className = styles[`heading${level}` as keyof typeof styles];
    const props = { id, className };

    const element = (() => {
      switch (level) {
        case 1:
          return <h1 {...props}>{children}</h1>;
        case 2:
          return <h2 {...props}>{children}</h2>;
        case 3:
          return <h3 {...props}>{children}</h3>;
        case 4:
          return <h4 {...props}>{children}</h4>;
        case 5:
          return <h5 {...props}>{children}</h5>;
        case 6:
          return <h6 {...props}>{children}</h6>;
        default:
          return <p {...props}>{children}</p>;
      }
    })();

    return wrapWithDiffStyle(element, text);
  };

  // Fix markdown formatting issues from Milkdown
  const body = content.replace(/!\[([^\]]*)\]\s*\n\s*\(/g, '![$1](');

  return (
    <div className={styles.markdownBody}>
      <Markdown
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => (
            <HeadingRenderer level={1}>{children}</HeadingRenderer>
          ),
          h2: ({ children }) => (
            <HeadingRenderer level={2}>{children}</HeadingRenderer>
          ),
          h3: ({ children }) => (
            <HeadingRenderer level={3}>{children}</HeadingRenderer>
          ),
          h4: ({ children }) => (
            <HeadingRenderer level={4}>{children}</HeadingRenderer>
          ),
          h5: ({ children }) => (
            <HeadingRenderer level={5}>{children}</HeadingRenderer>
          ),
          h6: ({ children }) => (
            <HeadingRenderer level={6}>{children}</HeadingRenderer>
          ),
          p: ({ children }) => {
            const text = String(children);
            const element = <p className={styles.paragraph}>{children}</p>;
            return wrapWithDiffStyle(element, text);
          },
          ul: ({ children }) => (
            <ul className={styles.list}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className={styles.orderedList}>{children}</ol>
          ),
          li: ({ children }) => (
            <li className={styles.listItem}>{children}</li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className={styles.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className={styles.codeBlock}>
                  <code>{children}</code>
                </pre>
              );
            }
            return <code className={styles.inlineCode}>{children}</code>;
          },
          blockquote: ({ children }) => (
            <blockquote className={styles.blockquote}>{children}</blockquote>
          ),
          img: ({ src, alt }) => {
            if (!src || src === '') {
              return (
                <span className={styles.imagePlaceholder}>
                  [Image: {alt || 'no alt text'} - missing src]
                </span>
              );
            }

            // Check if this is a video URL
            const videoType = detectVideoType(src);
            if (videoType !== 'unknown') {
              return <VideoEmbed src={src} alt={alt} />;
            }

            return (
              <img
                src={src}
                alt={alt}
                className={styles.image}
                loading="lazy"
              />
            );
          },
        }}
      >
        {body}
      </Markdown>
    </div>
  );
}

export default DiffMarkdownRenderer;
