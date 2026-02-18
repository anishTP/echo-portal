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
import { PasswordStrength } from '../components/auth';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, displayName);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Container size="1" py="9">
        <Card size="4">
          <Flex direction="column" gap="4" align="center">
            <Heading size="5">Account created</Heading>
            <Text size="2" color="gray" align="center">
              Your account has been created successfully. You can now sign in.
            </Text>
            <Button variant="soft" onClick={() => navigate('/login')}>
              Go to login
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
              <Heading size="5">Create your account</Heading>
              <Text size="2" color="gray">
                Sign up with your email address
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

            <label>
              <Text as="div" size="2" mb="1" weight="medium">
                Display name
              </Text>
              <TextField.Root
                type="text"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={isLoading}
                size="2"
                maxLength={100}
              />
            </label>

            <label>
              <Text as="div" size="2" mb="1" weight="medium">
                Password
              </Text>
              <TextField.Root
                type="password"
                placeholder="Create a password"
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
                Confirm password
              </Text>
              <TextField.Root
                type="password"
                placeholder="Confirm your password"
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
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>

            <Flex justify="center" gap="1">
              <Text size="2" color="gray">
                Already have an account?
              </Text>
              <RadixLink size="2" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>
                Log in
              </RadixLink>
            </Flex>
          </Flex>
        </form>
      </Card>
    </Container>
  );
}
