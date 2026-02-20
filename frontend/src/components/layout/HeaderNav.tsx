import { useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DropdownMenu, Button, Text, Flex, Spinner, Dialog, TextField, AlertDialog } from '@radix-ui/themes';
import { ChevronDownIcon, PlusIcon } from '@radix-ui/react-icons';
import { useCategories, useCreateCategory } from '../../hooks/usePublishedContent';
import { useAuth } from '../../context/AuthContext';
import { useBranchStore } from '../../stores/branchStore';

export function HeaderNav() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section');
  const { hasRole } = useAuth();
  const isAdmin = hasRole('administrator');

  // Branch state for gating category creation
  const currentBranch = useBranchStore((s) => s.currentBranch);
  const isInDraftBranch = currentBranch !== null && currentBranch.state === 'draft';

  // Branch-required dialog state
  const [branchRequiredOpen, setBranchRequiredOpen] = useState(false);

  // Per-section category queries (cached by TanStack Query)
  const brands = useCategories('brand');
  const products = useCategories('product');
  const experiences = useCategories('experience');

  // New category dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSection, setDialogSection] = useState<string>('');
  const [dialogSectionLabel, setDialogSectionLabel] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const createCategory = useCreateCategory();

  // Hover-triggered dropdown state
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedAtRef = useRef(0);

  const handleMouseEnter = useCallback((menu: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    // Ignore phantom mouseenter caused by portal unmounting (exposes trigger div underneath)
    if (Date.now() - closedAtRef.current < 150) return;
    setOpenMenu(menu);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      closedAtRef.current = Date.now();
      setOpenMenu(null);
    }, 150);
  }, []);

  const openNewCategoryDialog = useCallback((sectionValue: string, sectionLabel: string) => {
    setDialogSection(sectionValue);
    setDialogSectionLabel(sectionLabel);
    setNewCategoryName('');
    setDialogOpen(true);
  }, []);

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name || !dialogSection) return;
    await createCategory.mutateAsync({ name, section: dialogSection });
    setDialogOpen(false);
    setNewCategoryName('');
  }, [newCategoryName, dialogSection, createCategory]);

  const isActive = (s: string) => section === s;

  const handleSectionClick = useCallback((sectionName: string) => {
    navigate(`/library?section=${sectionName}`);
  }, [navigate]);

  const handleCategoryClick = (sectionName: string, category: string) => {
    setOpenMenu(null);
    navigate(`/library?section=${sectionName}&category=${encodeURIComponent(category)}`);
  };


  const dropdownItems = (
    sectionName: string,
    data: { categories: string[]; categoryCounts: Record<string, number>; isLoading: boolean }
  ) => {
    if (data.isLoading) {
      return (
        <Flex align="center" justify="center" py="3">
          <Spinner size="2" />
        </Flex>
      );
    }

    if (data.categories.length === 0) {
      return (
        <Flex align="center" justify="center" py="2" px="3">
          <Text size="2" style={{ color: 'var(--gray-9)' }}>No categories yet</Text>
        </Flex>
      );
    }

    return data.categories.map((cat) => (
      <DropdownMenu.Item
        key={cat}
        onClick={() => handleCategoryClick(sectionName, cat)}
      >
        <Flex align="center" justify="between" width="100%">
          <Text size="2">{cat}</Text>
          <Text size="1" style={{ color: 'var(--gray-9)' }}>
            {data.categoryCounts[cat] ?? 0}
          </Text>
        </Flex>
      </DropdownMenu.Item>
    ));
  };

  return (
    <nav className="flex items-center gap-6">
      {/* Brands dropdown */}
      <DropdownMenu.Root open={openMenu === 'brands'} onOpenChange={(open) => { if (!open) setOpenMenu(null); }} modal={false}>
        <div onMouseEnter={() => handleMouseEnter('brands')} onMouseLeave={handleMouseLeave}>
          <DropdownMenu.Trigger>
            <Button
              variant="ghost"
              size="3"
              style={{ color: isActive('brands') ? 'var(--accent-11)' : 'var(--gray-12)' }}
              onClick={() => handleSectionClick('brands')}
            >
              <Text size="3" weight="medium">Brands</Text>
              <ChevronDownIcon width="14" height="14" />
            </Button>
          </DropdownMenu.Trigger>
        </div>
        <DropdownMenu.Content style={{ minWidth: '180px' }} onMouseEnter={() => handleMouseEnter('brands')} onMouseLeave={handleMouseLeave} onCloseAutoFocus={(e) => e.preventDefault()}>
          {dropdownItems('brands', brands)}
          {isAdmin && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onClick={() => isInDraftBranch ? openNewCategoryDialog('brand', 'Brands') : setBranchRequiredOpen(true)}>
                <Flex align="center" gap="1">
                  <PlusIcon width={12} height={12} />
                  <Text size="2">New Category</Text>
                </Flex>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {/* Products dropdown */}
      <DropdownMenu.Root open={openMenu === 'products'} onOpenChange={(open) => { if (!open) setOpenMenu(null); }} modal={false}>
        <div onMouseEnter={() => handleMouseEnter('products')} onMouseLeave={handleMouseLeave}>
          <DropdownMenu.Trigger>
            <Button
              variant="ghost"
              size="3"
              style={{ color: isActive('products') ? 'var(--accent-11)' : 'var(--gray-12)' }}
              onClick={() => handleSectionClick('products')}
            >
              <Text size="3" weight="medium">Products</Text>
              <ChevronDownIcon width="14" height="14" />
            </Button>
          </DropdownMenu.Trigger>
        </div>
        <DropdownMenu.Content style={{ minWidth: '180px' }} onMouseEnter={() => handleMouseEnter('products')} onMouseLeave={handleMouseLeave} onCloseAutoFocus={(e) => e.preventDefault()}>
          {dropdownItems('products', products)}
          {isAdmin && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onClick={() => isInDraftBranch ? openNewCategoryDialog('product', 'Products') : setBranchRequiredOpen(true)}>
                <Flex align="center" gap="1">
                  <PlusIcon width={12} height={12} />
                  <Text size="2">New Category</Text>
                </Flex>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {/* Experiences dropdown */}
      <DropdownMenu.Root open={openMenu === 'experiences'} onOpenChange={(open) => { if (!open) setOpenMenu(null); }} modal={false}>
        <div onMouseEnter={() => handleMouseEnter('experiences')} onMouseLeave={handleMouseLeave}>
          <DropdownMenu.Trigger>
            <Button
              variant="ghost"
              size="3"
              style={{ color: isActive('experiences') ? 'var(--accent-11)' : 'var(--gray-12)' }}
              onClick={() => handleSectionClick('experiences')}
            >
              <Text size="3" weight="medium">Experiences</Text>
              <ChevronDownIcon width="14" height="14" />
            </Button>
          </DropdownMenu.Trigger>
        </div>
        <DropdownMenu.Content style={{ minWidth: '180px' }} onMouseEnter={() => handleMouseEnter('experiences')} onMouseLeave={handleMouseLeave} onCloseAutoFocus={(e) => e.preventDefault()}>
          {dropdownItems('experiences', experiences)}
          {isAdmin && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onClick={() => isInDraftBranch ? openNewCategoryDialog('experience', 'Experiences') : setBranchRequiredOpen(true)}>
                <Flex align="center" gap="1">
                  <PlusIcon width={12} height={12} />
                  <Text size="2">New Category</Text>
                </Flex>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {/* New Category Dialog (admin-only, draft branch) */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>New Category in {dialogSectionLabel}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Create a new category under {dialogSectionLabel}. Content can then be added to this category.
          </Dialog.Description>
          <Flex direction="column" gap="3">
            <TextField.Root
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
              }}
            />
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim() || createCategory.isPending}
            >
              {createCategory.isPending ? 'Creating...' : 'Create'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Branch required dialog (category creation outside draft branch) */}
      <AlertDialog.Root open={branchRequiredOpen} onOpenChange={setBranchRequiredOpen}>
        <AlertDialog.Content maxWidth="420px">
          <AlertDialog.Title>Draft branch required</AlertDialog.Title>
          <AlertDialog.Description size="2">
            Categories can only be added in a draft branch. Use the branch selector to create or switch to a draft branch, then try again.
          </AlertDialog.Description>
          <Flex justify="end" mt="4">
            <AlertDialog.Action>
              <Button>OK</Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </nav>
  );
}
