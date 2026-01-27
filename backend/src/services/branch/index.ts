export { BranchService, branchService } from './branch-service.js';
export type { BranchListOptions, BranchListResult } from './branch-service.js';

export { VisibilityService, visibilityService } from './visibility.js';
export type { AccessContext, VisibilityCheckResult } from './visibility.js';

export { TeamService, teamService } from './team.js';
export type { TeamMember } from './team.js';

export { OrphanDetectionService, orphanDetectionService } from './orphan-detection.js';
export type { OrphanedBranch, OrphanDetectionResult } from './orphan-detection.js';

export { LineageValidationService, lineageValidationService } from './lineage-validation.js';
export type { LineageNode, LineageChain, LineageValidationResult } from './lineage-validation.js';
