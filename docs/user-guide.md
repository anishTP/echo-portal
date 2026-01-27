# Echo Portal User Guide

This guide covers the core workflows for using Echo Portal's branch isolation model.

## Overview

Echo Portal enables governed contribution workflows where:
1. Contributors create isolated branches to work on changes
2. Reviewers approve or request changes
3. Publishers merge approved changes to main

## Roles

| Role | Capabilities |
|------|-------------|
| **Contributor** | Create branches, submit for review |
| **Reviewer** | Review branches, approve or request changes |
| **Publisher** | Publish approved branches to main |
| **Administrator** | All capabilities + user management |

---

## Workflows

### Creating a Branch

1. Navigate to the **Dashboard**
2. Click **Create Branch**
3. Fill in the branch details:
   - **Name**: Descriptive name for your changes
   - **Base Branch**: `main` (default)
   - **Description**: What changes you're making
   - **Visibility**: Who can see this branch
     - `private`: Only you and assigned reviewers
     - `team`: All team members with reviewer/publisher roles
     - `public`: Anyone with portal access
   - **Labels**: Optional tags for organization
4. Click **Create**

Your branch is now in **Draft** state.

### Working on Changes

While your branch is in Draft state:

1. Open your branch from the Dashboard
2. Use the workspace to make changes
3. Changes are automatically saved
4. View your changes using the **Diff** tab

### Submitting for Review

When your changes are ready:

1. Open your branch
2. Click **Submit for Review**
3. Optionally add a message explaining the changes
4. Assign reviewers (optional - team visibility branches can be reviewed by anyone with reviewer role)

Your branch moves to **Review** state.

### Managing Visibility

As a branch owner, you can control who sees your work:

1. Open your branch details
2. In the **Access Control** section, click **Visibility Settings**
3. Choose visibility level:
   - **Private**: Only you and explicitly assigned reviewers
   - **Team**: All team members with reviewer/publisher roles
   - **Public**: Anyone with portal access
4. Add or remove specific reviewers using the **Reviewers** picker

Note: Visibility can only be changed while the branch is in Draft state.

---

## Reviewing a Branch

### Finding Branches to Review

1. Navigate to **Review Queue** from the main menu
2. View all branches awaiting your review
3. Filter by status, labels, or search

### Conducting a Review

1. Open a branch from the Review Queue
2. View changes in the **Diff** tab
3. Add comments:
   - General comments in the review panel
   - Line-specific comments on the diff
4. Make a decision:
   - **Approve**: Changes are ready for publication
   - **Request Changes**: Changes need work before publication

### Review Outcomes

| Decision | Effect |
|----------|--------|
| **Approve** | Branch moves to Approved state |
| **Request Changes** | Branch returns to Draft state |

When changes are requested, the contributor can make updates and resubmit.

---

## Publishing a Branch

### Prerequisites

- Branch must be in **Approved** state
- You must have the **Publisher** role
- No unresolved conflicts with target branch

### Publishing Process

1. Open an approved branch
2. Click **Publish**
3. Review the pre-publish validation:
   - Conflict check
   - Warnings (if any)
4. Add an optional publish message
5. Click **Confirm Publish**

### What Happens During Publishing

1. **Validation**: Final conflict check against target
2. **Merge**: Changes are atomically merged to main
3. **Finalization**: Branch state changes to Published

If conflicts are detected, publication is blocked until resolved.

### Rollback

If an issue is discovered after publishing:
- Contact an administrator
- Rollback creates a new commit reverting the changes
- Original branch remains in Published state

---

## Branch States

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| **Draft** | Work in progress | Submit for Review, Archive |
| **Review** | Awaiting review | Back to Draft (request changes), Approve, Archive |
| **Approved** | Ready to publish | Publish |
| **Published** | Merged to main | Archive |
| **Archived** | No longer active | None |

### State Flow Diagram

```
     ┌──────────────────────────────────────┐
     │                                      │
     ▼                                      │
  ┌──────┐    Submit    ┌────────┐    Approve    ┌──────────┐    Publish    ┌───────────┐
  │ Draft│ ───────────► │ Review │ ─────────────►│ Approved │ ─────────────►│ Published │
  └──────┘              └────────┘               └──────────┘               └───────────┘
     ▲                      │                                                     │
     │      Request         │                                                     │
     └──────Changes─────────┘                                                     │
     │                                                                            │
     │                              ┌──────────┐                                  │
     └──────────────────────────────┤ Archived │◄─────────────────────────────────┘
                                    └──────────┘
```

---

## Viewing History and Lineage

### Branch Timeline

View the complete state history of a branch:

1. Open a branch
2. Navigate to the **History** tab
3. See all state transitions with:
   - Who made the change
   - When it happened
   - Optional reason/comment

### Branch Lineage

Understand how a branch relates to others:

1. Open a branch
2. Navigate to the **Lineage** tab
3. See:
   - Base commit and current head
   - Related branches (same base)
   - Publication information (if published)

### Audit Trail

Administrators and reviewers can access detailed audit logs:

1. Navigate to **Audit** from the admin menu
2. Filter by:
   - Resource type (branch, review, convergence)
   - Actor
   - Date range
   - Action type
3. View detailed event information

---

## Troubleshooting

### "Cannot submit for review"

- Ensure you are the branch owner
- Check that the branch is in Draft state
- Verify you have the Contributor role

### "Cannot publish"

- Branch must be in Approved state
- You need the Publisher role
- Check for conflicts with target branch

### "Access denied"

- Check your role assignments
- For private branches, you must be the owner or an assigned reviewer
- Contact an administrator if you believe this is an error

### Conflicts During Publishing

When conflicts are detected:

1. Return the branch to Draft state
2. Update the branch to resolve conflicts
3. Resubmit for review
4. Get re-approval
5. Attempt publishing again

---

## Best Practices

1. **Use descriptive names**: Makes branches easy to find and understand
2. **Write clear descriptions**: Help reviewers understand your changes
3. **Keep branches focused**: One feature or fix per branch
4. **Review promptly**: Don't leave branches waiting in review
5. **Use appropriate visibility**: Private for sensitive changes, team for normal work
6. **Add labels**: Organize branches by type, priority, or area
