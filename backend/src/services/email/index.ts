import { createSmtpTransport } from './smtp-transport.js';
import { createConsoleTransport } from './console-transport.js';

/**
 * Email service interface (FR-017)
 */
export interface EmailService {
  sendMail(options: EmailOptions): Promise<void>;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Factory: creates the appropriate email transport based on environment
 * - Production: SMTP via nodemailer (requires SMTP_HOST env var)
 * - Development: Console logging with full email content
 */
export function createEmailService(): EmailService {
  const smtpHost = process.env.SMTP_HOST;

  if (smtpHost && process.env.NODE_ENV === 'production') {
    return createSmtpTransport();
  }

  return createConsoleTransport();
}

// Singleton instance
let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailService) {
    emailService = createEmailService();
  }
  return emailService;
}
