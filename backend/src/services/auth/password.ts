import argon2 from 'argon2';

/**
 * Hash a password using argon2id (OWASP recommended)
 * FR-014: Secure, modern one-way hashing with appropriate cost factors
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

/**
 * Verify a password against a hash
 * FR-020: argon2.verify is timing-safe by design
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Validate password strength per FR-002:
 * - Minimum 8 characters
 * - At least 3 of 4 character types (uppercase, lowercase, number, special)
 *
 * Returns { valid, criteria } for both server validation and client feedback
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  criteria: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    typesCount: number;
  };
} {
  const criteria = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    typesCount: 0,
  };

  criteria.typesCount = [criteria.hasUppercase, criteria.hasLowercase, criteria.hasNumber, criteria.hasSpecial].filter(
    Boolean
  ).length;

  const valid = criteria.minLength && criteria.typesCount >= 3;

  return { valid, criteria };
}
