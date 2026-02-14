import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '../../src/services/auth/password.js';

describe('Password Service - Unit Tests', () => {
  describe('hashPassword', () => {
    it('should produce a hash string from a password', async () => {
      const hash = await hashPassword('TestPass1!');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      // argon2id hashes start with $argon2id$
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should produce different hashes for different passwords', async () => {
      const hash1 = await hashPassword('Password1!');
      const hash2 = await hashPassword('Password2!');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for the same password (salting)', async () => {
      const hash1 = await hashPassword('SamePassword1!');
      const hash2 = await hashPassword('SamePassword1!');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for a correct password', async () => {
      const password = 'CorrectPass1!';
      const hash = await hashPassword(password);

      const result = await verifyPassword(hash, password);

      expect(result).toBe(true);
    });

    it('should return false for a wrong password', async () => {
      const hash = await hashPassword('CorrectPass1!');

      const result = await verifyPassword(hash, 'WrongPass1!');

      expect(result).toBe(false);
    });

    it('should return false on an invalid hash', async () => {
      const result = await verifyPassword('not-a-valid-hash', 'AnyPassword1!');

      expect(result).toBe(false);
    });

    it('should return false on an empty hash string', async () => {
      const result = await verifyPassword('', 'AnyPassword1!');

      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should reject a password that is too short', () => {
      const result = validatePasswordStrength('Ab1!');

      expect(result.valid).toBe(false);
      expect(result.criteria.minLength).toBe(false);
    });

    it('should reject a password with only lowercase characters', () => {
      const result = validatePasswordStrength('abcdefgh');

      expect(result.valid).toBe(false);
      expect(result.criteria.minLength).toBe(true);
      expect(result.criteria.hasLowercase).toBe(true);
      expect(result.criteria.hasUppercase).toBe(false);
      expect(result.criteria.hasNumber).toBe(false);
      expect(result.criteria.hasSpecial).toBe(false);
      expect(result.criteria.typesCount).toBe(1);
    });

    it('should reject a password with only 2 character types (lowercase + number)', () => {
      const result = validatePasswordStrength('abcdef12');

      expect(result.valid).toBe(false);
      expect(result.criteria.minLength).toBe(true);
      expect(result.criteria.hasLowercase).toBe(true);
      expect(result.criteria.hasNumber).toBe(true);
      expect(result.criteria.hasUppercase).toBe(false);
      expect(result.criteria.hasSpecial).toBe(false);
      expect(result.criteria.typesCount).toBe(2);
    });

    it('should accept a password with 3 character types (lowercase + uppercase + number)', () => {
      const result = validatePasswordStrength('Abcdef12');

      expect(result.valid).toBe(true);
      expect(result.criteria.minLength).toBe(true);
      expect(result.criteria.hasLowercase).toBe(true);
      expect(result.criteria.hasUppercase).toBe(true);
      expect(result.criteria.hasNumber).toBe(true);
      expect(result.criteria.hasSpecial).toBe(false);
      expect(result.criteria.typesCount).toBe(3);
    });

    it('should accept a password with all 4 character types', () => {
      const result = validatePasswordStrength('Abcdef1!');

      expect(result.valid).toBe(true);
      expect(result.criteria.minLength).toBe(true);
      expect(result.criteria.hasLowercase).toBe(true);
      expect(result.criteria.hasUppercase).toBe(true);
      expect(result.criteria.hasNumber).toBe(true);
      expect(result.criteria.hasSpecial).toBe(true);
      expect(result.criteria.typesCount).toBe(4);
    });

    it('should detect uppercase correctly', () => {
      const result = validatePasswordStrength('AAAAAAAA');

      expect(result.criteria.hasUppercase).toBe(true);
      expect(result.criteria.hasLowercase).toBe(false);
      expect(result.criteria.hasNumber).toBe(false);
      expect(result.criteria.hasSpecial).toBe(false);
      expect(result.criteria.typesCount).toBe(1);
    });

    it('should detect numbers correctly', () => {
      const result = validatePasswordStrength('12345678');

      expect(result.criteria.hasUppercase).toBe(false);
      expect(result.criteria.hasLowercase).toBe(false);
      expect(result.criteria.hasNumber).toBe(true);
      expect(result.criteria.hasSpecial).toBe(false);
      expect(result.criteria.typesCount).toBe(1);
    });

    it('should detect special characters correctly', () => {
      const result = validatePasswordStrength('!@#$%^&*');

      expect(result.criteria.hasUppercase).toBe(false);
      expect(result.criteria.hasLowercase).toBe(false);
      expect(result.criteria.hasNumber).toBe(false);
      expect(result.criteria.hasSpecial).toBe(true);
      expect(result.criteria.typesCount).toBe(1);
    });

    it('should reject a password that meets 3 types but is too short', () => {
      const result = validatePasswordStrength('Ab1!');

      expect(result.valid).toBe(false);
      expect(result.criteria.minLength).toBe(false);
      expect(result.criteria.typesCount).toBe(4);
    });

    it('should accept exactly 8 characters with 3 types', () => {
      const result = validatePasswordStrength('Abcdefg1');

      expect(result.valid).toBe(true);
      expect(result.criteria.minLength).toBe(true);
      expect(result.criteria.typesCount).toBe(3);
    });

    it('should reject exactly 7 characters even with all 4 types', () => {
      const result = validatePasswordStrength('Abcd1!z');

      expect(result.valid).toBe(false);
      expect(result.criteria.minLength).toBe(false);
    });
  });
});
