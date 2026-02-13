import { notificationService } from './notification-service.js';

/**
 * Fire-and-forget lifecycle notification triggers.
 * All functions use .catch() to never block the triggering action.
 */

export function notifyCollaboratorAdded(
  branchId: string,
  collaboratorId: string,
  branchName: string,
  actorId: string
): void {
  notificationService
    .createBulk(
      [collaboratorId],
      {
        type: 'collaborator_added',
        category: 'lifecycle',
        title: 'Added as Collaborator',
        message: `You have been added as a collaborator on "${branchName}"`,
        resourceType: 'branch',
        resourceId: branchId,
        actorId,
      },
      { branchId }
    )
    .catch((err) => console.error('[NotificationTriggers] collaborator_added failed:', err));
}

export function notifyCollaboratorRemoved(
  branchId: string,
  collaboratorId: string,
  branchName: string,
  actorId: string
): void {
  notificationService
    .createBulk(
      [collaboratorId],
      {
        type: 'collaborator_removed',
        category: 'lifecycle',
        title: 'Removed as Collaborator',
        message: `You have been removed as a collaborator from "${branchName}"`,
        resourceType: 'branch',
        resourceId: branchId,
        actorId,
      },
      { branchId }
    )
    .catch((err) => console.error('[NotificationTriggers] collaborator_removed failed:', err));
}

export function notifyContentPublished(
  branchId: string,
  branchName: string,
  recipientIds: string[],
  actorId: string
): void {
  notificationService
    .createBulk(
      recipientIds,
      {
        type: 'content_published',
        category: 'lifecycle',
        title: 'Content Published',
        message: `"${branchName}" has been published`,
        resourceType: 'branch',
        resourceId: branchId,
        actorId,
      },
      { branchId }
    )
    .catch((err) => console.error('[NotificationTriggers] content_published failed:', err));
}

export function notifyBranchArchived(
  branchId: string,
  branchName: string,
  ownerId: string,
  actorId: string
): void {
  notificationService
    .createBulk(
      [ownerId],
      {
        type: 'branch_archived',
        category: 'lifecycle',
        title: 'Branch Archived',
        message: `"${branchName}" has been archived`,
        resourceType: 'branch',
        resourceId: branchId,
        actorId,
      },
      { branchId }
    )
    .catch((err) => console.error('[NotificationTriggers] branch_archived failed:', err));
}

export function notifyAIComplianceError(
  branchId: string,
  branchName: string,
  recipientIds: string[],
  actorId: string,
  findingSummary: string
): void {
  notificationService
    .createBulk(
      recipientIds,
      {
        type: 'ai_compliance_error',
        category: 'ai',
        title: 'AI Compliance Issue Detected',
        message: `Compliance issue found on "${branchName}": ${findingSummary.slice(0, 100)}`,
        resourceType: 'branch',
        resourceId: branchId,
        actorId,
      },
      { branchId }
    )
    .catch((err) => console.error('[NotificationTriggers] ai_compliance_error failed:', err));
}

export function notifyRoleChanged(
  userId: string,
  oldRole: string,
  newRole: string,
  actorId: string
): void {
  notificationService
    .createBulk(
      [userId],
      {
        type: 'role_changed',
        category: 'lifecycle',
        title: 'Role Changed',
        message: `Your role has been changed from ${oldRole} to ${newRole}`,
        resourceType: 'user',
        resourceId: userId,
        actorId,
      }
    )
    .catch((err) => console.error('[NotificationTriggers] role_changed failed:', err));
}
