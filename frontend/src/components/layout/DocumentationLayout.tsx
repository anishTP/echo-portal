import { useState, useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
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

  // Shared forceRender for both header and sidebar retained-content cleanup
  const [, forceRender] = useState(0);

  // --- Content header animated exit via CSS transitions ---
  const contentHeaderRef = useRef<HTMLDivElement>(null);
  const lastHeaderRef = useRef<ReactNode>(null);
  const retainedHeaderRef = useRef<ReactNode>(null);
  const prevHeaderRef = useRef(!!header);

  if (header) {
    lastHeaderRef.current = header;
    retainedHeaderRef.current = null;
  }
  if (prevHeaderRef.current && !header && !retainedHeaderRef.current) {
    retainedHeaderRef.current = lastHeaderRef.current;
  }
  prevHeaderRef.current = !!header;

  const headerToRender = header ?? retainedHeaderRef.current;
  const isHeaderExiting = !header && !!retainedHeaderRef.current;

  // When exit starts: snapshot width (prevents expansion as margin-right
  // transitions away) and collapse layout space via max-height so the
  // content below rises in sync with the visual translateY slide-up.
  useLayoutEffect(() => {
    const el = contentHeaderRef.current;
    if (isHeaderExiting && el) {
      const rect = el.getBoundingClientRect();
      el.style.width = `${rect.width}px`;
      el.style.maxHeight = `${rect.height}px`;
      void el.offsetHeight; // force reflow — commit explicit dimensions
      el.style.maxHeight = '0px'; // triggers max-height transition
    } else if (el) {
      el.style.width = '';
      el.style.maxHeight = '';
    }
  }, [isHeaderExiting]);

  // When header enters with AI panel offset, apply margin-right AND sidebar collapse
  // instantly (no transition) so the two width changes cancel out and content doesn't
  // get double-squeezed during a 300ms gap.
  const centerWrapperRef = useRef<HTMLDivElement>(null);
  const prevHadHeaderForTransition = useRef(!!header);
  useLayoutEffect(() => {
    const headerJustAppeared = !!header && !prevHadHeaderForTransition.current;
    prevHadHeaderForTransition.current = !!header;

    const el = centerWrapperRef.current;
    if (headerJustAppeared && contentRightOffset && el) {
      el.style.transition = 'none';
      // Also skip sidebar collapse transition to prevent double-squeeze
      const sidebarEl = rightSidebarRef.current;
      if (sidebarEl) sidebarEl.style.transition = 'none';
      el.getBoundingClientRect(); // force reflow — both changes apply instantly
      requestAnimationFrame(() => {
        el.style.transition = '';
        if (sidebarEl) sidebarEl.style.transition = '';
      });
      // Clear retained sidebar content (transitionend won't fire without a transition)
      if (retainedSidebarRef.current) {
        retainedSidebarRef.current = null;
        forceRender((c) => c + 1);
      }
    }
  });

  const handleHeaderTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.propertyName !== 'transform') return;
    if (retainedHeaderRef.current) {
      retainedHeaderRef.current = null;
      forceRender((c) => c + 1);
    }
  }, []);

  // --- Right sidebar animated entrance/exit via CSS transitions ---
  // Uses CSS transitions instead of anime.js to avoid React strict mode
  // and re-render interference. The browser handles the animation natively.
  const rightSidebarRef = useRef<HTMLElement>(null);
  const lastSidebarRef = useRef<ReactNode>(null);
  const retainedSidebarRef = useRef<ReactNode>(null);
  const prevSidebarRef = useRef(!!rightSidebar);

  if (rightSidebar) {
    lastSidebarRef.current = rightSidebar;
    retainedSidebarRef.current = null;
  }

  // When sidebar prop disappears, retain its content for the exit transition
  if (prevSidebarRef.current && !rightSidebar && !retainedSidebarRef.current) {
    retainedSidebarRef.current = lastSidebarRef.current;
  }
  prevSidebarRef.current = !!rightSidebar;

  const sidebarContent = rightSidebar ?? retainedSidebarRef.current;
  const isSidebarCollapsed = !rightSidebar;

  // Handle transitionend to clear retained sidebar content after exit animation
  const handleSidebarTransitionEnd = useCallback((e: React.TransitionEvent) => {
    // Only act on the width transition (not opacity) to avoid double-fire
    if (e.propertyName !== 'width') return;
    if (retainedSidebarRef.current) {
      retainedSidebarRef.current = null;
      forceRender((c) => c + 1);
    }
  }, []);

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
        ref={centerWrapperRef}
        className={styles.centerWrapper}
        style={contentRightOffset ? { marginRight: contentRightOffset } : undefined}
      >
        {headerToRender && (
          <div
            ref={contentHeaderRef}
            className={styles.contentHeader}
            data-exiting={isHeaderExiting || undefined}
            onTransitionEnd={isHeaderExiting ? handleHeaderTransitionEnd : undefined}
          >
            {headerToRender}
          </div>
        )}
        <div className={styles.centerBody}>
          <main className={styles.main}>
            <div className={fullWidth ? styles.mainContentFullWidth : styles.mainContent}>{children}</div>
          </main>

          {/* Right Sidebar — always in DOM for enter/exit CSS transitions */}
          <aside
            ref={rightSidebarRef}
            className={styles.rightSidebar}
            data-collapsed={isSidebarCollapsed || undefined}
            onTransitionEnd={retainedSidebarRef.current ? handleSidebarTransitionEnd : undefined}
            aria-label="Page sidebar"
          >
            {sidebarContent && <div className={styles.rightSidebarInner}>{sidebarContent}</div>}
          </aside>
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
