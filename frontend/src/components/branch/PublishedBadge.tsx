import { Badge, Card, Flex, Text, Box } from '@radix-ui/themes';
import type { BranchResponse } from '../../services/branchService';

interface PublishedBadgeProps {
  branch: BranchResponse;
  showDetails?: boolean;
}

const LockIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const XIcon = () => (
  <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export function PublishedBadge({ branch, showDetails = false }: PublishedBadgeProps) {
  // Only show for published branches
  if (branch.state !== 'published') {
    return null;
  }

  const publishedDate = branch.publishedAt
    ? new Date(branch.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Unknown';

  if (!showDetails) {
    // Compact badge version
    return (
      <Badge color="green" variant="soft" size="1" radius="full">
        <LockIcon />
        <span>Published (Immutable)</span>
      </Badge>
    );
  }

  // Detailed card version
  return (
    <Card style={{ backgroundColor: 'var(--green-2)', borderColor: 'var(--green-6)' }}>
      <Flex gap="3" align="start">
        <Box
          style={{
            backgroundColor: 'var(--green-3)',
            borderRadius: 'var(--radius-full)',
            padding: 'var(--space-2)',
          }}
        >
          <svg className="h-6 w-6" style={{ color: 'var(--green-11)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </Box>

        <Flex direction="column" gap="2" style={{ flex: 1 }}>
          <Text weight="medium" size="2" style={{ color: 'var(--green-12)' }}>
            Published & Immutable
          </Text>
          <Text size="2" style={{ color: 'var(--green-11)' }}>
            This branch was published on {publishedDate} and can no longer be modified.
          </Text>

          <Flex direction="column" gap="2" mt="2">
            <Flex align="start" gap="2">
              <Box style={{ color: 'var(--green-11)', marginTop: '2px' }}><XIcon /></Box>
              <Text size="2" style={{ color: 'var(--green-11)' }}>Branch content cannot be changed</Text>
            </Flex>
            <Flex align="start" gap="2">
              <Box style={{ color: 'var(--green-11)', marginTop: '2px' }}><XIcon /></Box>
              <Text size="2" style={{ color: 'var(--green-11)' }}>Reviewers and collaborators cannot be modified</Text>
            </Flex>
            <Flex align="start" gap="2">
              <Box style={{ color: 'var(--green-11)', marginTop: '2px' }}><XIcon /></Box>
              <Text size="2" style={{ color: 'var(--green-11)' }}>Branch settings are locked</Text>
            </Flex>
            <Flex align="start" gap="2">
              <Box style={{ color: 'var(--green-11)', marginTop: '2px' }}><CheckIcon /></Box>
              <Text size="2" style={{ color: 'var(--green-11)' }}>Branch is available for viewing and deployment</Text>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

export default PublishedBadge;
