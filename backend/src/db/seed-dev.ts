import { db } from './index.js';
import { users } from './schema/users.js';
import { branches } from './schema/branches.js';

const DEV_USER: {
  id: string;
  externalId: string;
  provider: 'github';
  email: string;
  displayName: string;
  roles: ('viewer' | 'contributor' | 'reviewer' | 'administrator')[];
  isActive: boolean;
} = {
  id: '00000000-0000-0000-0000-000000000001',
  externalId: 'dev-user',
  provider: 'github',
  email: 'dev@example.com',
  displayName: 'Dev User',
  roles: ['contributor', 'reviewer', 'administrator'],
  isActive: true,
};

// System user for owning the main branch
const SYSTEM_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  externalId: 'system',
  provider: 'github' as const,
  email: 'system@echo-portal.internal',
  displayName: 'System',
  roles: ['administrator' as const],
  isActive: true,
};

// Canonical main branch holding published content
const MAIN_BRANCH = {
  id: '00000000-0000-0000-0000-000000000100',
  name: 'Main',
  slug: 'main',
  gitRef: 'refs/heads/main',
  baseRef: 'main',
  baseCommit: 'initial', // Placeholder until first convergence
  headCommit: 'initial',
  state: 'published' as const,
  visibility: 'public' as const,
  ownerId: SYSTEM_USER.id,
  reviewers: [],
  collaborators: [],
  assignedReviewers: [],
  requiredApprovals: 1,
  description: 'Canonical published content',
  labels: ['system'],
};

async function seed() {
  // Seed system user first (needed as owner for main branch)
  console.log('Seeding system user...');
  const existingSystem = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, SYSTEM_USER.id),
  });
  if (!existingSystem) {
    await db.insert(users).values(SYSTEM_USER);
    console.log('System user created successfully');
  } else {
    console.log('System user already exists');
  }

  // Seed dev user
  console.log('Seeding dev user...');
  const existingDev = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, DEV_USER.id),
  });
  if (!existingDev) {
    await db.insert(users).values(DEV_USER);
    console.log('Dev user created successfully');
  } else {
    console.log('Dev user already exists');
  }

  // Seed main branch (canonical published content branch)
  console.log('Seeding main branch...');
  const existingMain = await db.query.branches.findFirst({
    where: (b, { eq }) => eq(b.slug, 'main'),
  });
  if (!existingMain) {
    await db.insert(branches).values(MAIN_BRANCH);
    console.log('Main branch created successfully');
  } else {
    console.log('Main branch already exists');
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
