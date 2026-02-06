/**
 * DiffMarkdownRenderer - Renders markdown content for the unified diff view.
 *
 * Renders the article body as clean prose (like ContentRenderer).
 * Metadata changes are shown in the header, not in the body.
 */

import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { VideoEmbed, detectVideoType } from '../editor/VideoEmbed';
import styles from './FullArticleDiffView.module.css';

interface DiffMarkdownRendererProps {
  content: string;
}

/**
 * Renders markdown body as clean prose.
 * Used in the unified view to display the full article.
 */
export function DiffMarkdownRenderer({ content }: DiffMarkdownRendererProps) {
  // Custom heading renderer with IDs for linking
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
          p: ({ children }) => (
            <p className={styles.paragraph}>{children}</p>
          ),
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
          ins: ({ children }) => (
            <ins className={styles.inlineDiffAddition}>{children}</ins>
          ),
          del: ({ children }) => (
            <del className={styles.inlineDiffDeletion}>{children}</del>
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
