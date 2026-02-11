import { useState, useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { animate as animateEl } from 'animejs';
import type { JSAnimation } from 'animejs';
import { HamburgerMenuIcon, Cross1Icon } from '@radix-ui/react-icons';
import styles from './DocumentationLayout.module.css';

export interface DocumentationLayoutProps {
  /** Left sidebar content (navigation) */
  sidebar: ReactNode;
  /** Main content area */
  children: ReactNode;
  /** Optional right sidebar content (TOC, metadata) */
  rightSidebar?: ReactNode;
  /** Optional header content (e.g., edit mode banner) */
  header?: ReactNode;
  /** Whether main content should expand to full width (no max-width constraint) */
  fullWidth?: boolean;
  /** Optional right margin offset to make room for fixed panels (e.g., AI chat) */
  contentRightOffset?: number | string;
}

/**
 * Documentation-style three-column layout
 *
 * - Left sidebar (280px): Navigation, search, filters
 * - Main content (flexible): Primary content area
 * - Right sidebar (320px, optional): TOC, metadata
 * - Header (optional): Banner above main content (e.g., edit mode indicator)
 *
 * Mobile: Left sidebar collapses with hamburger menu
 * Tablet: Right sidebar hidden
 */
export function DocumentationLayout({
  sidebar,
  children,
  rightSidebar,
  header,
  fullWidth = false,
  contentRightOffset,
}: DocumentationLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // --- Right sidebar animated entrance/exit ---
  const rightSidebarRef = useRef<HTMLElement>(null);
  const sidebarAnimRef = useRef<JSAnimation | null>(null);
  const lastSidebarRef = useRef<ReactNode>(null);
  const [retainedSidebar, setRetainedSidebar] = useState<ReactNode>(null);
  const hadSidebarRef = useRef(!!rightSidebar);

  // Synchronously capture the last non-null sidebar content
  if (rightSidebar) {
    lastSidebarRef.current = rightSidebar;
  }

  // Derived state: when sidebar disappears, retain its content for exit animation
  if (hadSidebarRef.current && !rightSidebar && !retainedSidebar) {
    setRetainedSidebar(lastSidebarRef.current);
  }
  if (rightSidebar && retainedSidebar) {
    setRetainedSidebar(null);
  }
  hadSidebarRef.current = !!rightSidebar || !!retainedSidebar;

  const sidebarToRender = rightSidebar ?? retainedSidebar;
  const isSidebarExiting = !rightSidebar && !!retainedSidebar;

  // Entrance animation: width grows from 0, opacity fades in
  const sidebarPresentOnMountRef = useRef(!!rightSidebar);
  useLayoutEffect(() => {
    const el = rightSidebarRef.current;
    if (!rightSidebar || !el) return;
    // Skip entrance animation on initial mount (sidebar was already present)
    if (sidebarPresentOnMountRef.current) {
      sidebarPresentOnMountRef.current = false;
      return;
    }
    const targetWidth = parseFloat(getComputedStyle(el).width) || 408;
    sidebarAnimRef.current?.cancel();
    el.style.overflow = 'hidden';
    sidebarAnimRef.current = animateEl(el, {
      width: [0, targetWidth],
      opacity: [0, 1],
      duration: 300,
      ease: 'out(3)',
      onComplete: () => { el.style.overflow = ''; el.style.width = ''; },
    });
    return () => {
      sidebarAnimRef.current?.cancel();
      el.style.overflow = '';
      el.style.width = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when sidebar presence toggles
  }, [!!rightSidebar]);

  // Exit animation: width shrinks to 0, opacity fades out
  useLayoutEffect(() => {
    const el = rightSidebarRef.current;
    if (!isSidebarExiting || !el) return;
    const currentWidth = el.getBoundingClientRect().width;
    sidebarAnimRef.current?.cancel();
    el.style.overflow = 'hidden';
    sidebarAnimRef.current = animateEl(el, {
      width: [currentWidth, 0],
      opacity: [1, 0],
      duration: 300,
      ease: 'out(3)',
      onComplete: () => {
        el.style.overflow = '';
        el.style.width = '';
        setRetainedSidebar(null);
      },
    });
    return () => {
      sidebarAnimRef.current?.cancel();
      el.style.overflow = '';
      el.style.width = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when exit state changes
  }, [isSidebarExiting]);

  return (
    <div className={styles.layout}>
      {/* Mobile overlay */}
      <div
        className={styles.mobileOverlay}
        data-open={isMobileMenuOpen}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      {/* Left Sidebar */}
      <aside
        className={styles.leftSidebar}
        data-open={isMobileMenuOpen}
        aria-label="Navigation sidebar"
      >
        <div className={styles.sidebarInner}>{sidebar}</div>
      </aside>

      {/* Center area: header spans full width, main + right sidebar sit below */}
      <div
        className={styles.centerWrapper}
        style={contentRightOffset ? { marginRight: contentRightOffset } : undefined}
      >
        {header && <div className={styles.contentHeader}>{header}</div>}
        <div className={styles.centerBody}>
          <main className={styles.main}>
            <div className={fullWidth ? styles.mainContentFullWidth : styles.mainContent}>{children}</div>
          </main>

          {/* Right Sidebar (optional, with delayed unmount for exit animation) */}
          {sidebarToRender && (
            <aside ref={rightSidebarRef} className={styles.rightSidebar} aria-label="Page sidebar">
              <div className={styles.rightSidebarInner}>{sidebarToRender}</div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button
        className={styles.mobileMenuButton}
        onClick={toggleMobileMenu}
        aria-label={isMobileMenuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? (
          <Cross1Icon width={20} height={20} />
        ) : (
          <HamburgerMenuIcon width={20} height={20} />
        )}
      </button>
    </div>
  );
}

export default DocumentationLayout;
