import { google, type OAuthUserInfo } from '../config.js';

export async function getGoogleAuthorizationURL(state: string, codeVerifier: string): Promise<URL> {
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);
  return url;
}

export async function validateGoogleCallback(
  code: string,
  codeVerifier: string
): Promise<OAuthUserInfo> {
  const tokens = await google.validateAuthorizationCode(code, codeVerifier);

  // Fetch user info from Google API
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const user = (await userResponse.json()) as {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.picture,
  };
}
