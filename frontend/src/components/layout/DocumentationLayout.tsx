import { useState, useCallback, type ReactNode } from 'react';
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
}

/**
 * Documentation-style three-column layout
 *
 * - Left sidebar (280px): Navigation, search, filters
 * - Main content (flexible): Primary content area
 * - Right sidebar (240px, optional): TOC, metadata
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
}: DocumentationLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
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

      {/* Main Content */}
      <main className={styles.main}>
        {header && <div className={styles.contentHeader}>{header}</div>}
        <div className={fullWidth ? styles.mainContentFullWidth : styles.mainContent}>{children}</div>
      </main>

      {/* Right Sidebar (optional) */}
      {rightSidebar && (
        <aside className={styles.rightSidebar} aria-label="Page sidebar">
          <div className={styles.rightSidebarInner}>{rightSidebar}</div>
        </aside>
      )}

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
