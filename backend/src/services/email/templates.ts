const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Generate verification email content
 */
export function verificationEmail(token: string): {
  subject: string;
  text: string;
  html: string;
} {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;

  return {
    subject: 'Verify your Echo Portal account',
    text: [
      'Welcome to Echo Portal!',
      '',
      'Please verify your email address by clicking the link below:',
      '',
      verifyUrl,
      '',
      'This link expires in 24 hours.',
      '',
      'If you did not create an account, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Echo Portal!</h2>
        <p>Please verify your email address by clicking the button below:</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background: #0070f3; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Verify Email Address
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you did not create an account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          Can't click the button? Copy and paste this URL into your browser:<br />
          <a href="${verifyUrl}" style="color: #0070f3;">${verifyUrl}</a>
        </p>
      </div>
    `.trim(),
  };
}

/**
 * Generate password reset email content
 */
export function passwordResetEmail(token: string): {
  subject: string;
  text: string;
  html: string;
} {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    subject: 'Reset your Echo Portal password',
    text: [
      'Password Reset Request',
      '',
      'You requested a password reset for your Echo Portal account.',
      'Click the link below to set a new password:',
      '',
      resetUrl,
      '',
      'This link expires in 1 hour.',
      '',
      'If you did not request a password reset, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Echo Portal account. Click the button below to set a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #0070f3; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
        <p style="color: #666; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          Can't click the button? Copy and paste this URL into your browser:<br />
          <a href="${resetUrl}" style="color: #0070f3;">${resetUrl}</a>
        </p>
      </div>
    `.trim(),
  };
}
