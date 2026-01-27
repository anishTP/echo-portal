import { github, type OAuthUserInfo } from '../config.js';

export async function getGitHubAuthorizationURL(state: string): Promise<URL> {
  const url = github.createAuthorizationURL(state, ['user:email', 'read:user']);
  return url;
}

export async function validateGitHubCallback(code: string): Promise<OAuthUserInfo> {
  const tokens = await github.validateAuthorizationCode(code);

  // Fetch user info from GitHub API
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
      'User-Agent': 'Echo-Portal',
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch GitHub user info');
  }

  const user = (await userResponse.json()) as {
    id: number;
    email: string | null;
    name: string | null;
    login: string;
    avatar_url: string;
  };

  // If no public email, fetch from emails endpoint
  let email = user.email;
  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
        'User-Agent': 'Echo-Portal',
      },
    });

    if (emailsResponse.ok) {
      const emails = (await emailsResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }
  }

  if (!email) {
    throw new Error('Could not retrieve email from GitHub');
  }

  return {
    id: String(user.id),
    email,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
  };
}
