import type { EmailService, EmailOptions } from './index.js';

/**
 * Console email transport for development
 * Logs the full email content including action URLs for easy testing
 */
export function createConsoleTransport(): EmailService {
  return {
    async sendMail(options: EmailOptions): Promise<void> {
      console.log('\n' + '='.repeat(60));
      console.log('[EMAIL] Development Mode — Email Not Sent');
      console.log('='.repeat(60));
      console.log(`To:      ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log('-'.repeat(60));
      console.log(options.text);
      console.log('='.repeat(60) + '\n');
    },
  };
}
