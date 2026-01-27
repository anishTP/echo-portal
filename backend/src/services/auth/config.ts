import { GitHub, Google } from 'arctic';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// GitHub OAuth provider
export const github = new GitHub(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, `${BASE_URL}/api/v1/auth/callback/github`);

// Google OAuth provider
export const google = new Google(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  `${BASE_URL}/api/v1/auth/callback/google`
);

export const AUTH_SECRET = process.env.AUTH_SECRET || 'development-secret-change-in-production';

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Session {
  userId: string;
  email: string;
  roles: string[];
  expiresAt: Date;
}
