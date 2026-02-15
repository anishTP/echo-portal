import { type ReactNode } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRightIcon, PlusIcon } from '@radix-ui/react-icons';
import styles from './NavSection.module.css';

export interface NavItem {
  /** Unique identifier for the item */
  id: string;
  /** Display label */
  label: string;
  /** Optional count badge */
  count?: number;
  /** Click handler */
  onClick?: () => void;
  /** URL for link items */
  href?: string;
}

export interface NavSectionProps {
  /** Section title */
  title: string;
  /** Navigation items in this section */
  items: NavItem[];
  /** Currently active item ID */
  activeItemId?: string;
  /** Whether section is initially open */
  defaultOpen?: boolean;
  /** Callback when an item is clicked */
  onItemClick?: (item: NavItem) => void;
  /** Custom content instead of items */
  children?: ReactNode;
  /** Callback when add button is clicked (shows button when defined) */
  onAdd?: () => void;
  /** Custom element to replace the title (e.g. an inline rename input) */
  titleElement?: ReactNode;
}

/**
 * Collapsible navigation section for sidebar
 *
 * Uses Radix UI Collapsible primitive with theme integration.
 * Supports dynamic items with active state and count badges.
 */
export function NavSection({
  title,
  items,
  activeItemId,
  defaultOpen = true,
  onItemClick,
  children,
  onAdd,
  titleElement,
}: NavSectionProps) {
  const handleItemClick = (item: NavItem) => {
    item.onClick?.();
    onItemClick?.(item);
  };

  return (
    <Collapsible.Root className={styles.section} defaultOpen={defaultOpen}>
      <div className={styles.triggerRow}>
        {titleElement ? (
          <div className={styles.trigger} style={{ cursor: 'default' }}>
            {titleElement}
          </div>
        ) : (
          <Collapsible.Trigger className={styles.trigger}>
            <span>{title}</span>
            <ChevronRightIcon className={styles.chevron} width={14} height={14} />
          </Collapsible.Trigger>
        )}
        {!titleElement && onAdd && (
          <button
            type="button"
            className={styles.addButton}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={`Add content to ${title}`}
            title={`Add content to ${title}`}
          >
            <PlusIcon width={14} height={14} />
          </button>
        )}
      </div>

      <Collapsible.Content className={styles.content}>
        {children ? (
          children
        ) : (
          <ul className={styles.navList}>
            {items.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <a
                    href={item.href}
                    className={styles.navItem}
                    data-active={activeItemId === item.id}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault();
                        handleItemClick(item);
                      }
                    }}
                  >
                    {item.label}
                    {item.count !== undefined && (
                      <span className={styles.count}>{item.count}</span>
                    )}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={styles.navItem}
                    data-active={activeItemId === item.id}
                    onClick={() => handleItemClick(item)}
                  >
                    {item.label}
                    {item.count !== undefined && (
                      <span className={styles.count}>{item.count}</span>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export default NavSection;
