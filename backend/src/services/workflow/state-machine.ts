import { createMachine, assign, type AnyMachineSnapshot } from 'xstate';
import {
  BranchState,
  TransitionEvent,
  ValidTransitions,
  type BranchStateType,
  type TransitionEventType,
} from '@echo-portal/shared';

/**
 * Context for the branch workflow state machine
 */
export interface BranchMachineContext {
  branchId: string;
  ownerId: string;
  reviewers: string[];
  hasApproval: boolean;
  approvalCount: number;
  requiredApprovals: number;
  actorId: string;
  actorRoles: string[];
  reason?: string;
  errorMessage?: string;
}

/**
 * Events that can be sent to the state machine
 */
export type BranchMachineEvent =
  | { type: 'SUBMIT_FOR_REVIEW'; actorId: string; actorRoles: string[]; reason?: string }
  | { type: 'REQUEST_CHANGES'; actorId: string; actorRoles: string[]; reason?: string }
  | { type: 'APPROVE'; actorId: string; actorRoles: string[]; reason?: string }
  | { type: 'PUBLISH'; actorId: string; actorRoles: string[]; reason?: string }
  | { type: 'ARCHIVE'; actorId: string; actorRoles: string[]; reason?: string };

/**
 * Event to state mapping
 */
export const EventToTargetState: Record<TransitionEventType, BranchStateType> = {
  [TransitionEvent.SUBMIT_FOR_REVIEW]: BranchState.REVIEW,
  [TransitionEvent.REQUEST_CHANGES]: BranchState.DRAFT,
  [TransitionEvent.APPROVE]: BranchState.APPROVED,
  [TransitionEvent.PUBLISH]: BranchState.PUBLISHED,
  [TransitionEvent.ARCHIVE]: BranchState.ARCHIVED,
};

/**
 * Role requirements for each transition event
 * Note: Contributors can be assigned as reviewers, so they need to be able to
 * approve or request changes. The isReviewerGuard ensures they're actually assigned.
 */
export const EventRoleRequirements: Record<TransitionEventType, string[]> = {
  [TransitionEvent.SUBMIT_FOR_REVIEW]: ['contributor', 'reviewer', 'publisher', 'administrator'],
  [TransitionEvent.REQUEST_CHANGES]: ['contributor', 'reviewer', 'publisher', 'administrator'],
  [TransitionEvent.APPROVE]: ['contributor', 'reviewer', 'publisher', 'administrator'],
  [TransitionEvent.PUBLISH]: ['publisher', 'administrator'],
  [TransitionEvent.ARCHIVE]: ['contributor', 'reviewer', 'publisher', 'administrator'],
};

/**
 * Create the branch workflow state machine
 */
export const branchMachine = createMachine({
  id: 'branchWorkflow',
  initial: 'draft',
  types: {
    context: {} as BranchMachineContext,
    events: {} as BranchMachineEvent,
  },
  context: {
    branchId: '',
    ownerId: '',
    reviewers: [],
    hasApproval: false,
    approvalCount: 0,
    requiredApprovals: 1,
    actorId: '',
    actorRoles: [],
    reason: undefined,
    errorMessage: undefined,
  },
  states: {
    draft: {
      on: {
        SUBMIT_FOR_REVIEW: {
          target: 'review',
          guard: 'canSubmitForReview',
          actions: assign({
            actorId: ({ event }) => event.actorId,
            actorRoles: ({ event }) => event.actorRoles,
            reason: ({ event }) => event.reason,
          }),
        },
        ARCHIVE: {
          target: 'archived',
          guard: 'canArchive',
          actions: assign({
            actorId: ({ event }) => event.actorId,
            actorRoles: ({ event }) => event.actorRoles,
            reason: ({ event }) => event.reason,
          }),
        },
      },
    },
    review: {
      on: {
        REQUEST_CHANGES: {
          target: 'draft',
          guard: 'canRequestChanges',
          actions: assign({
            actorId: ({ event }) => event.actorId,
            actorRoles: ({ event }) => event.actorRoles,
            reason: ({ event }) => event.reason,
            hasApproval: false,
            approvalCount: 0,
          }),
        },
        APPROVE: [
          {
            // If approval threshold is met, transition to approved
            target: 'approved',
            guard: 'meetsApprovalThreshold',
            actions: assign({
              actorId: ({ event }) => event.actorId,
              actorRoles: ({ event }) => event.actorRoles,
              reason: ({ event }) => event.reason,
              hasApproval: true,
              approvalCount: ({ context }) => context.approvalCount + 1,
            }),
          },
          {
            // Otherwise, stay in review and increment approval count
            target: 'review',
            guard: 'canApprove',
            actions: assign({
              actorId: ({ event }) => event.actorId,
              actorRoles: ({ event }) => event.actorRoles,
              reason: ({ event }) => event.reason,
              hasApproval: true,
              approvalCount: ({ context }) => context.approvalCount + 1,
            }),
          },
        ],
        ARCHIVE: {
          target: 'archived',
          guard: 'canArchive',
          actions: assign({
            actorId: ({ event }) => event.actorId,
            actorRoles: ({ event }) => event.actorRoles,
            reason: ({ event }) => event.reason,
          }),
        },
      },
    },
    approved: {
      on: {
        PUBLISH: {
          target: 'published',
          guard: 'canPublish',
          actions: assign({
            actorId: ({ event }) => event.actorId,
            actorRoles: ({ event }) => event.actorRoles,
            reason: ({ event }) => event.reason,
          }),
        },
      },
    },
    published: {
      on: {
        ARCHIVE: {
          target: 'archived',
          guard: 'canArchive',
          actions: assign({
            actorId: ({ event }) => event.actorId,
            actorRoles: ({ event }) => event.actorRoles,
            reason: ({ event }) => event.reason,
          }),
        },
      },
    },
    archived: {
      type: 'final',
    },
  },
});

/**
 * Check if a transition is valid based on the current state
 */
export function isValidTransition(
  currentState: BranchStateType,
  targetState: BranchStateType
): boolean {
  const validTargets = ValidTransitions[currentState] || [];
  return validTargets.includes(targetState);
}

/**
 * Get allowed events for a given state
 */
export function getAllowedEvents(currentState: BranchStateType): TransitionEventType[] {
  const validTargets = ValidTransitions[currentState] || [];
  const allowedEvents: TransitionEventType[] = [];

  for (const [event, target] of Object.entries(EventToTargetState)) {
    if (validTargets.includes(target as BranchStateType)) {
      allowedEvents.push(event as TransitionEventType);
    }
  }

  return allowedEvents;
}

/**
 * Check if user has required role for an event
 */
export function hasRequiredRole(event: TransitionEventType, userRoles: string[]): boolean {
  const requiredRoles = EventRoleRequirements[event] || [];
  return userRoles.some((role) => requiredRoles.includes(role));
}

/**
 * Get the target state for an event
 */
export function getTargetState(event: TransitionEventType): BranchStateType {
  return EventToTargetState[event];
}

/**
 * Validate that a transition can be performed
 */
export function canPerformTransition(
  currentState: BranchStateType,
  event: TransitionEventType,
  userRoles: string[]
): { allowed: boolean; reason?: string } {
  const targetState = getTargetState(event);

  if (!isValidTransition(currentState, targetState)) {
    return {
      allowed: false,
      reason: `Cannot transition from '${currentState}' to '${targetState}'`,
    };
  }

  if (!hasRequiredRole(event, userRoles)) {
    return {
      allowed: false,
      reason: `Insufficient permissions. Required roles: ${EventRoleRequirements[event].join(', ')}`,
    };
  }

  return { allowed: true };
}
