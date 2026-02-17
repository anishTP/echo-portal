import { useState, useMemo } from 'react';
import { Flex, Heading, TextField, Button } from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useAuth } from '../../context/AuthContext';
import { useMyBranches, useReviewBranches, useBranchList, useDeleteBranch } from '../../hooks/useBranch';
import { DashboardFilterTabs, type DashboardFilter } from './DashboardFilterTabs';
import { BranchTable } from './BranchTable';
import { ProfilePagination } from './ProfilePagination';
import { BranchCreate } from '../branch';
import type { BranchResponse } from '../../services/branchService';

const PAGE_LIMIT = 10;

export function DashboardPanel() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<DashboardFilter>('my');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const canPublish = user?.roles?.some(
    (role: string) => role === 'administrator' || role === 'publisher'
  );

  const { data: myBranches = [], isLoading: loadingMy } = useMyBranches(true);
  const { data: reviewBranches = [], isLoading: loadingReview } = useReviewBranches();
  const { data: approvedData, isLoading: loadingApproved } = useBranchList({
    state: ['approved'],
    limit: 50,
  });
  const { data: allData, isLoading: loadingAll } = useBranchList({ limit: 50 });
  const deleteBranch = useDeleteBranch();

  const approvedBranches = canPublish ? (approvedData?.data ?? []) : [];
  const allBranches = allData?.data ?? [];

  const counts = {
    my: myBranches.length,
    review: reviewBranches.length,
    publish: approvedBranches.length,
    all: allBranches.length,
  };

  const filteredBranches = useMemo(() => {
    let branches: BranchResponse[];
    switch (filter) {
      case 'my':
        branches = myBranches;
        break;
      case 'review':
        branches = reviewBranches;
        break;
      case 'publish':
        branches = approvedBranches;
        break;
      case 'all':
        branches = allBranches;
        break;
      default:
        branches = myBranches;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      branches = branches.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.description?.toLowerCase().includes(q) ?? false)
      );
    }

    return branches;
  }, [filter, search, myBranches, reviewBranches, approvedBranches, allBranches]);

  const total = filteredBranches.length;
  const paginatedBranches = filteredBranches.slice(
    (page - 1) * PAGE_LIMIT,
    page * PAGE_LIMIT
  );

  const isLoading =
    (filter === 'my' && loadingMy) ||
    (filter === 'review' && loadingReview) ||
    (filter === 'publish' && loadingApproved) ||
    (filter === 'all' && loadingAll);

  const handleFilterChange = (f: DashboardFilter) => {
    setFilter(f);
    setPage(1);
  };

  const handleDelete = (branchId: string) => {
    deleteBranch.mutate(branchId);
  };

  return (
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center">
        <Heading size="5">Dashboard</Heading>
        <Button size="2" onClick={() => setShowCreate(true)}>
          New Branch
        </Button>
      </Flex>

      <DashboardFilterTabs
        activeFilter={filter}
        onFilterChange={handleFilterChange}
        counts={counts}
        showPublish={!!canPublish}
      />

      <TextField.Root
        placeholder="Search branches..."
        size="2"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      >
        <TextField.Slot>
          <MagnifyingGlassIcon />
        </TextField.Slot>
      </TextField.Root>

      <BranchTable
        branches={paginatedBranches}
        isLoading={isLoading}
        currentUserId={user?.id}
        onDelete={handleDelete}
      />

      <ProfilePagination
        page={page}
        limit={PAGE_LIMIT}
        total={total}
        onPageChange={setPage}
      />

      {/* Create Branch Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Create New Branch</h2>
            <BranchCreate
              onSuccess={(branchId) => {
                setShowCreate(false);
                window.location.href = `/branches/${branchId}`;
              }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </Flex>
  );
}
