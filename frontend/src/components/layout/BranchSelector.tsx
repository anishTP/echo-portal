import { DropdownMenu, Button, Text, Flex, Spinner } from '@radix-ui/themes';
import { useNavigate } from 'react-router-dom';
import { useBranchStore } from '../../stores/branchStore';
import { useMyBranches, useReviewBranches } from '../../hooks/useBranch';
import { LifecycleStatus } from '../branch/LifecycleStatus';

// Globe icon for "Published" state
const GlobeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

// Git branch icon
const BranchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

// Plus icon for new branch
const PlusIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// Checkmark icon
const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function BranchSelector() {
  const navigate = useNavigate();
  const { currentBranch, setCurrentBranch, setIsCreating } = useBranchStore();

  const { data: myBranches, isLoading: isLoadingMy } = useMyBranches();
  const { data: reviewBranches, isLoading: isLoadingReview } = useReviewBranches();

  const isLoading = isLoadingMy || isLoadingReview;

  // Limit to 5 recent branches for "My Branches"
  const recentBranches = myBranches?.slice(0, 5) ?? [];
  // Limit to 3 review branches
  const recentReviewBranches = reviewBranches?.slice(0, 3) ?? [];

  const handleSelectPublished = () => {
    setCurrentBranch(null);
    navigate('/library');
  };

  const handleSelectBranch = (branch: typeof myBranches extends (infer T)[] | undefined ? T : never) => {
    if (branch) {
      setCurrentBranch(branch);
      navigate(`/branches/${branch.id}`);
    }
  };

  const handleViewAllBranches = () => {
    navigate('/dashboard');
  };

  const handleNewBranch = () => {
    setIsCreating(true);
    navigate('/dashboard');
  };

  // Determine if we're on a branch or viewing published content
  const isOnBranch = currentBranch !== null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button
          variant="ghost"
          size="2"
          style={{ maxWidth: '200px' }}
        >
          <Flex align="center" gap="2">
            {isOnBranch ? (
              <>
                <BranchIcon />
                <Text
                  size="2"
                  style={{
                    maxWidth: '100px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentBranch.name}
                </Text>
                <LifecycleStatus state={currentBranch.state} size="sm" />
              </>
            ) : (
              <>
                <GlobeIcon />
                <Text size="2">Published</Text>
              </>
            )}
          </Flex>
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content align="end" style={{ minWidth: '220px' }}>
        {/* Published (Main) option */}
        <DropdownMenu.Item onClick={handleSelectPublished}>
          <Flex align="center" justify="between" width="100%">
            <Flex align="center" gap="2">
              <GlobeIcon />
              <Text>Published (Main)</Text>
            </Flex>
            {!isOnBranch && <CheckIcon />}
          </Flex>
        </DropdownMenu.Item>

        <DropdownMenu.Separator />

        {/* Loading state */}
        {isLoading ? (
          <Flex align="center" justify="center" py="3">
            <Spinner size="2" />
          </Flex>
        ) : (
          <>
            {/* My Branches section */}
            {recentBranches.length > 0 && (
              <>
                <DropdownMenu.Label>My Branches</DropdownMenu.Label>
                {recentBranches.map((branch) => (
                  <DropdownMenu.Item
                    key={branch.id}
                    onClick={() => handleSelectBranch(branch)}
                  >
                    <Flex align="center" justify="between" width="100%">
                      <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
                        <BranchIcon />
                        <Text
                          size="2"
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {branch.name}
                        </Text>
                        <LifecycleStatus state={branch.state} size="sm" />
                      </Flex>
                      {currentBranch?.id === branch.id && <CheckIcon />}
                    </Flex>
                  </DropdownMenu.Item>
                ))}
              </>
            )}

            {/* Empty state for My Branches */}
            {recentBranches.length === 0 && (
              <>
                <DropdownMenu.Label>My Branches</DropdownMenu.Label>
                <Flex align="center" justify="center" py="2">
                  <Text size="1" color="gray">No branches yet</Text>
                </Flex>
              </>
            )}

            {/* To Review section */}
            {recentReviewBranches.length > 0 && (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Label>To Review</DropdownMenu.Label>
                {recentReviewBranches.map((branch) => (
                  <DropdownMenu.Item
                    key={branch.id}
                    onClick={() => handleSelectBranch(branch)}
                  >
                    <Flex align="center" justify="between" width="100%">
                      <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
                        <BranchIcon />
                        <Text
                          size="2"
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {branch.name}
                        </Text>
                        <LifecycleStatus state={branch.state} size="sm" />
                      </Flex>
                      {currentBranch?.id === branch.id && <CheckIcon />}
                    </Flex>
                  </DropdownMenu.Item>
                ))}
              </>
            )}

            <DropdownMenu.Separator />

            {/* View All Branches link */}
            <DropdownMenu.Item onClick={handleViewAllBranches}>
              View All Branches
            </DropdownMenu.Item>

            {/* New Branch action */}
            <DropdownMenu.Item onClick={handleNewBranch}>
              <Flex align="center" gap="2">
                <PlusIcon />
                <Text>New Branch</Text>
              </Flex>
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export default BranchSelector;
