import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConsoleTransport } from '../../src/services/email/console-transport.js';
import { verificationEmail, passwordResetEmail } from '../../src/services/email/templates.js';

// Mock the smtp-transport module so the factory can be tested without nodemailer
vi.mock('../../src/services/email/smtp-transport.js', () => ({
  createSmtpTransport: vi.fn(() => ({
    sendMail: vi.fn(),
  })),
}));

describe('Console Transport', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should return an object with a sendMail method', () => {
    const transport = createConsoleTransport();
    expect(transport).toHaveProperty('sendMail');
    expect(typeof transport.sendMail).toBe('function');
  });

  it('should log email details to console', async () => {
    const transport = createConsoleTransport();

    await transport.sendMail({
      to: 'user@example.com',
      subject: 'Test Subject',
      text: 'Test body content',
      html: '<p>Test body content</p>',
    });

    expect(consoleSpy).toHaveBeenCalled();

    const allOutput = consoleSpy.mock.calls.map((call) => call[0]).join('\n');
    expect(allOutput).toContain('user@example.com');
    expect(allOutput).toContain('Test Subject');
    expect(allOutput).toContain('Test body content');
    expect(allOutput).toContain('[EMAIL]');
  });

  it('should resolve without throwing', async () => {
    const transport = createConsoleTransport();

    await expect(
      transport.sendMail({
        to: 'a@b.com',
        subject: 's',
        text: 't',
        html: '<p>t</p>',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('Email Templates', () => {
  describe('verificationEmail', () => {
    it('should return the correct subject', () => {
      const result = verificationEmail('abc123');
      expect(result.subject).toBe('Verify your Echo Portal account');
    });

    it('should include the token in the verify URL within text', () => {
      const result = verificationEmail('my-token-xyz');
      expect(result.text).toContain('/verify-email?token=my-token-xyz');
    });

    it('should include the token in the verify URL within html', () => {
      const result = verificationEmail('my-token-xyz');
      expect(result.html).toContain('/verify-email?token=my-token-xyz');
    });

    it('should URL-encode special characters in the token', () => {
      const result = verificationEmail('token with spaces&special=chars');
      const encoded = encodeURIComponent('token with spaces&special=chars');
      expect(result.text).toContain(`/verify-email?token=${encoded}`);
      expect(result.html).toContain(`/verify-email?token=${encoded}`);
    });

    it('should include expiry information', () => {
      const result = verificationEmail('tok');
      expect(result.text).toContain('24 hours');
      expect(result.html).toContain('24 hours');
    });

    it('should return subject, text, and html keys', () => {
      const result = verificationEmail('t');
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('html');
    });
  });

  describe('passwordResetEmail', () => {
    it('should return the correct subject', () => {
      const result = passwordResetEmail('reset-abc');
      expect(result.subject).toBe('Reset your Echo Portal password');
    });

    it('should include the token in the reset URL within text', () => {
      const result = passwordResetEmail('reset-token-123');
      expect(result.text).toContain('/reset-password?token=reset-token-123');
    });

    it('should include the token in the reset URL within html', () => {
      const result = passwordResetEmail('reset-token-123');
      expect(result.html).toContain('/reset-password?token=reset-token-123');
    });

    it('should URL-encode special characters in the token', () => {
      const result = passwordResetEmail('tok&en=val ue');
      const encoded = encodeURIComponent('tok&en=val ue');
      expect(result.text).toContain(`/reset-password?token=${encoded}`);
      expect(result.html).toContain(`/reset-password?token=${encoded}`);
    });

    it('should include expiry information', () => {
      const result = passwordResetEmail('tok');
      expect(result.text).toContain('1 hour');
      expect(result.html).toContain('1 hour');
    });

    it('should return subject, text, and html keys', () => {
      const result = passwordResetEmail('t');
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('html');
    });
  });
});

describe('createEmailService factory', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSmtpHost = process.env.SMTP_HOST;

  afterEach(() => {
    // Restore original env values
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalSmtpHost === undefined) {
      delete process.env.SMTP_HOST;
    } else {
      process.env.SMTP_HOST = originalSmtpHost;
    }

    vi.resetModules();
  });

  it('should return console transport when NODE_ENV is not production', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SMTP_HOST;

    const { createEmailService } = await import('../../src/services/email/index.js');
    const service = createEmailService();

    // Console transport logs to console when sendMail is called
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await service.sendMail({
      to: 'test@test.com',
      subject: 'Test',
      text: 'body',
      html: '<p>body</p>',
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should return console transport when SMTP_HOST is not set', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;

    const { createEmailService } = await import('../../src/services/email/index.js');
    const service = createEmailService();

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await service.sendMail({
      to: 'test@test.com',
      subject: 'Test',
      text: 'body',
      html: '<p>body</p>',
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should return SMTP transport when NODE_ENV is production and SMTP_HOST is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.example.com';

    const { createEmailService } = await import('../../src/services/email/index.js');
    const { createSmtpTransport } = await import(
      '../../src/services/email/smtp-transport.js'
    );

    createEmailService();

    expect(createSmtpTransport).toHaveBeenCalled();
  });

  it('should return console transport when NODE_ENV is undefined and SMTP_HOST is set', async () => {
    delete process.env.NODE_ENV;
    process.env.SMTP_HOST = 'smtp.example.com';

    const { createEmailService } = await import('../../src/services/email/index.js');
    const service = createEmailService();

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await service.sendMail({
      to: 'test@test.com',
      subject: 'Test',
      text: 'body',
      html: '<p>body</p>',
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
