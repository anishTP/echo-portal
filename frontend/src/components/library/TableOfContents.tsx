import { useState, useEffect, useMemo } from 'react';
import { Button } from '@radix-ui/themes';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  markdown: string;
}

/**
 * Parse headings from markdown content
 */
function parseHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Match markdown headings (## Heading)
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // Generate id from text (lowercase, replace spaces with hyphens)
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      headings.push({ id, text, level });
    }
  }

  return headings;
}

export function TableOfContents({ markdown }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const headings = useMemo(() => parseHeadings(markdown), [markdown]);

  // Track scroll position to highlight active heading
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0,
      }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (headings.length === 0) {
    return null;
  }

  // Find minimum heading level to normalize indentation
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        On this page
      </h2>
      <ul className="space-y-2">
        {headings.map((heading) => {
          const indent = (heading.level - minLevel) * 12;
          const isActive = activeId === heading.id;

          return (
            <li key={heading.id} style={{ paddingLeft: `${indent}px` }}>
              <Button
                variant="ghost"
                size="1"
                color={isActive ? 'blue' : 'gray'}
                onClick={() => handleClick(heading.id)}
                style={{ width: '100%', justifyContent: 'flex-start', fontWeight: isActive ? 500 : 400 }}
              >
                {heading.text}
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default TableOfContents;
