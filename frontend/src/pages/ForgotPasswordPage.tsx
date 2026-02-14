import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Link as RadixLink,
} from '@radix-ui/themes';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.status === 429) {
        setError('Too many requests. Please try again later.');
        return;
      }

      // Always show success (no account enumeration)
      setSubmitted(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <Container size="1" py="9">
        <Card size="4">
          <Flex direction="column" gap="4" align="center">
            <Heading size="5">Check your email</Heading>
            <Text size="2" color="gray" align="center">
              If an account exists with <Text weight="medium">{email}</Text>, we've sent a
              password reset link. The link expires in 1 hour.
            </Text>
            <Button variant="soft" onClick={() => navigate('/login')}>
              Back to login
            </Button>
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
              <Heading size="5">Forgot your password?</Heading>
              <Text size="2" color="gray" align="center">
                Enter your email address and we'll send you a link to reset your password.
              </Text>
            </Flex>

            {error && (
              <Callout.Root color="red" size="1">
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
                disabled={isLoading}
                size="2"
              />
            </label>

            <Button type="submit" disabled={isLoading} size="2" style={{ width: '100%' }}>
              {isLoading ? <Spinner size="2" /> : null}
              {isLoading ? 'Sending...' : 'Send reset link'}
            </Button>

            <Flex justify="center">
              <RadixLink size="2" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>
                Back to login
              </RadixLink>
            </Flex>
          </Flex>
        </form>
      </Card>
    </Container>
  );
}
