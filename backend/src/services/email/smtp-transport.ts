import nodemailer from 'nodemailer';
import type { EmailService, EmailOptions } from './index.js';

/**
 * SMTP email transport using nodemailer
 * Configured via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM env vars
 */
export function createSmtpTransport(): EmailService {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const from = process.env.SMTP_FROM || 'noreply@echo-portal.com';

  return {
    async sendMail(options: EmailOptions): Promise<void> {
      try {
        await transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
      } catch (error) {
        console.error('[EMAIL] Failed to send email:', error);
        throw error;
      }
    },
  };
}
