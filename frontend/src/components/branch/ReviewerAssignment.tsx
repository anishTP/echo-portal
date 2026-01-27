/**
 * ReviewerAssignment Component
 *
 * This component manages reviewer assignment for branches, including:
 * - Displaying current reviewers with full details
 * - Searching for potential reviewers
 * - Adding/removing reviewers
 * - Enforcing mutual exclusion with collaborators (FR-017c)
 *
 * Note: This is a wrapper around TeamMemberPicker for semantic clarity.
 * The implementation is shared as both serve the same purpose of managing
 * team member assignments on branches.
 */

import { TeamMemberPicker, type TeamMember } from './TeamMemberPicker';

export interface ReviewerAssignmentProps {
  branchId: string;
  currentReviewers?: string[];
  disabled?: boolean;
  onReviewersChange?: (reviewers: TeamMember[]) => void;
}

/**
 * ReviewerAssignment component for managing branch reviewers
 *
 * Features:
 * - Search and add reviewers
 * - Remove reviewers
 * - Display reviewer roles and avatars
 * - Mutual exclusion with collaborators (backend enforced)
 * - Disabled state for non-draft branches
 */
export function ReviewerAssignment(props: ReviewerAssignmentProps) {
  return <TeamMemberPicker {...props} />;
}

export default ReviewerAssignment;
export type { TeamMember };
