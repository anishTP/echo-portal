import { useState, type FormEvent } from 'react';
import { Button, TextField, Text, Flex, Spinner, Callout, Link as RadixLink } from '@radix-ui/themes';

interface EmailLoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  onForgotPassword?: () => void;
  disabled?: boolean;
}

export function EmailLoginForm({ onSubmit, onForgotPassword, disabled }: EmailLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setIsLoading(true);

    try {
      await onSubmit(email, password);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'needsVerification' in err) {
        setNeedsVerification(true);
        setError((err as { message?: string }).message || 'Please verify your email address before logging in');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="3">
        {error && (
          <Callout.Root color={needsVerification ? 'amber' : 'red'} size="1">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <label>
          <Text as="div" size="2" mb="1" weight="medium">
            Email
          </Text>
          <TextField.Root
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={disabled || isLoading}
            size="2"
          />
        </label>

        <label>
          <Text as="div" size="2" mb="1" weight="medium">
            Password
          </Text>
          <TextField.Root
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={disabled || isLoading}
            size="2"
          />
        </label>

        {onForgotPassword && (
          <Flex justify="end">
            <RadixLink
              size="2"
              onClick={(e) => {
                e.preventDefault();
                onForgotPassword();
              }}
              style={{ cursor: 'pointer' }}
            >
              Forgot password?
            </RadixLink>
          </Flex>
        )}

        <Button type="submit" disabled={disabled || isLoading} size="2" style={{ width: '100%' }}>
          {isLoading ? <Spinner size="2" /> : null}
          {isLoading ? 'Signing in...' : 'Sign in with email'}
        </Button>
      </Flex>
    </form>
  );
}

export default EmailLoginForm;
