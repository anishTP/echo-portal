import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Heading,
  Text,
  Flex,
  Card,
  TextField,
  Button,
  Spinner,
  Callout,
} from '@radix-ui/themes';
import { PasswordStrength } from '../components/auth';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = password === confirmPassword;

  if (!token) {
    return (
      <Container size="1" py="9">
        <Card size="4">
          <Flex direction="column" gap="4" align="center">
            <Heading size="5">Invalid reset link</Heading>
            <Text size="2" color="gray">
              This password reset link is invalid or missing. Please request a new one.
            </Text>
            <Button variant="soft" onClick={() => navigate('/forgot-password')}>
              Request new link
            </Button>
          </Flex>
        </Card>
      </Container>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Password reset failed');
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Container size="1" py="9">
        <Card size="4">
          <Flex direction="column" gap="4" align="center">
            <Heading size="5">Password reset successful</Heading>
            <Callout.Root color="green" size="1">
              <Callout.Text>
                Your password has been reset. You can now log in with your new password.
              </Callout.Text>
            </Callout.Root>
            <Button onClick={() => navigate('/login')}>Go to login</Button>
          </Flex>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="1" py="9">
      <Card size="4">
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            <Flex direction="column" gap="2" align="center">
              <Heading size="5">Set a new password</Heading>
              <Text size="2" color="gray">
                Enter your new password below.
              </Text>
            </Flex>

            {error && (
              <Callout.Root color="red" size="1">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}

            <label>
              <Text as="div" size="2" mb="1" weight="medium">
                New password
              </Text>
              <TextField.Root
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                size="2"
                minLength={8}
                maxLength={128}
              />
            </label>

            <PasswordStrength password={password} />

            <label>
              <Text as="div" size="2" mb="1" weight="medium">
                Confirm new password
              </Text>
              <TextField.Root
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                size="2"
              />
              {confirmPassword && !passwordsMatch && (
                <Text size="1" color="red" mt="1">
                  Passwords do not match
                </Text>
              )}
            </label>

            <Button type="submit" disabled={isLoading || !passwordsMatch} size="2" style={{ width: '100%' }}>
              {isLoading ? <Spinner size="2" /> : null}
              {isLoading ? 'Resetting...' : 'Reset password'}
            </Button>
          </Flex>
        </form>
      </Card>
    </Container>
  );
}
