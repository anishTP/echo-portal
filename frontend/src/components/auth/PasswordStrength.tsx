import { useMemo } from 'react';
import { Flex, Text, Box } from '@radix-ui/themes';

interface PasswordStrengthProps {
  password: string;
}

interface PasswordCriteria {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  typesCount: number;
}

function evaluatePassword(password: string): PasswordCriteria {
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
  return criteria;
}

function getStrengthLevel(criteria: PasswordCriteria): {
  label: string;
  color: string;
  segments: number;
} {
  if (!criteria.minLength) {
    return { label: 'Too short', color: 'var(--red-9)', segments: 0 };
  }
  if (criteria.typesCount <= 1) {
    return { label: 'Weak', color: 'var(--red-9)', segments: 1 };
  }
  if (criteria.typesCount === 2) {
    return { label: 'Fair', color: 'var(--amber-9)', segments: 2 };
  }
  if (criteria.typesCount === 3) {
    return { label: 'Strong', color: 'var(--green-9)', segments: 3 };
  }
  return { label: 'Very strong', color: 'var(--green-11)', segments: 4 };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const criteria = useMemo(() => evaluatePassword(password), [password]);
  const strength = useMemo(() => getStrengthLevel(criteria), [criteria]);

  if (!password) {
    return null;
  }

  const isValid = criteria.minLength && criteria.typesCount >= 3;

  return (
    <Flex direction="column" gap="2">
      {/* Segmented strength bar */}
      <Flex gap="1">
        {[1, 2, 3, 4].map((segment) => (
          <Box
            key={segment}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              backgroundColor: segment <= strength.segments ? strength.color : 'var(--gray-4)',
              transition: 'background-color 0.2s',
            }}
          />
        ))}
      </Flex>

      <Flex justify="between" align="center">
        <Text size="1" color={isValid ? 'green' : undefined} style={{ color: isValid ? undefined : strength.color }}>
          {strength.label}
        </Text>
        <Text size="1" color="gray">
          {criteria.typesCount}/4 types ({isValid ? 'meets requirement' : 'need 3 of 4'})
        </Text>
      </Flex>

      {/* Criteria checklist */}
      <Flex direction="column" gap="1">
        <CriteriaItem met={criteria.minLength} label="At least 8 characters" />
        <CriteriaItem met={criteria.hasUppercase} label="Uppercase letter (A-Z)" />
        <CriteriaItem met={criteria.hasLowercase} label="Lowercase letter (a-z)" />
        <CriteriaItem met={criteria.hasNumber} label="Number (0-9)" />
        <CriteriaItem met={criteria.hasSpecial} label="Special character (!@#$...)" />
      </Flex>
    </Flex>
  );
}

function CriteriaItem({ met, label }: { met: boolean; label: string }) {
  return (
    <Flex align="center" gap="1">
      <Text size="1" color={met ? 'green' : 'gray'}>
        {met ? '\u2713' : '\u2022'}
      </Text>
      <Text size="1" color={met ? 'green' : 'gray'}>
        {label}
      </Text>
    </Flex>
  );
}

export default PasswordStrength;
