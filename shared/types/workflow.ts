import type { BranchStateType, TransitionEventType, ActorTypeValue } from '../constants/states.js';

export interface TransitionContext {
  branchId: string;
  actorId: string;
  actorType: ActorTypeValue;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  success: boolean;
  fromState: BranchStateType;
  toState?: BranchStateType;
  error?: string;
  transitionId?: string;
}

export interface WorkflowGuard {
  name: string;
  check: (context: TransitionContext) => Promise<boolean>;
  errorMessage: string;
}

export interface StateTransitionDef {
  event: TransitionEventType;
  from: BranchStateType;
  to: BranchStateType;
  guards: string[];
  allowedRoles: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actorId: string;
  actorType: ActorTypeValue;
  actorIp?: string;
  actorUserAgent?: string;
  resourceType: 'branch' | 'review' | 'convergence' | 'user';
  resourceId: string;
  metadata: Record<string, unknown>;
  requestId?: string;
  sessionId?: string;
}
