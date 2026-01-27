import { db } from './index.js';
import { users } from './schema/users.js';

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

async function seed() {
  console.log('Seeding dev user...');

  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, DEV_USER.id),
  });

  if (existing) {
    console.log('Dev user already exists');
    return;
  }

  // Insert dev user
  await db.insert(users).values(DEV_USER);
  console.log('Dev user created successfully');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
