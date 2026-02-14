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
  Separator,
} from '@radix-ui/themes';
import { PasswordStrength } from '../components/auth';
import { useAuth } from '../context/AuthContext';

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user, isAuthenticated, changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isAuthenticated || !user) {
    navigate('/login', { replace: true });
    return null;
  }

  const isEmailUser = (user as { provider?: string } & typeof user).provider === 'email';
  const passwordsMatch = newPassword === confirmNewPassword;

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!passwordsMatch) {
      setError('New passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container size="2" py="9">
      <Flex direction="column" gap="6">
        <Heading size="6">Account Settings</Heading>

        {/* Account Info */}
        <Card size="3">
          <Flex direction="column" gap="3">
            <Heading size="4">Account Information</Heading>
            <Flex direction="column" gap="2">
              <Flex gap="2">
                <Text size="2" weight="medium" style={{ minWidth: 100 }}>
                  Email:
                </Text>
                <Text size="2">{user.email}</Text>
              </Flex>
              <Flex gap="2">
                <Text size="2" weight="medium" style={{ minWidth: 100 }}>
                  Display Name:
                </Text>
                <Text size="2">{user.displayName}</Text>
              </Flex>
            </Flex>
          </Flex>
        </Card>

        {/* Password Change — only for email users */}
        {isEmailUser ? (
          <Card size="3">
            <form onSubmit={handleChangePassword}>
              <Flex direction="column" gap="4">
                <Heading size="4">Change Password</Heading>

                {success && (
                  <Callout.Root color="green" size="1">
                    <Callout.Text>{success}</Callout.Text>
                  </Callout.Root>
                )}

                {error && (
                  <Callout.Root color="red" size="1">
                    <Callout.Text>{error}</Callout.Text>
                  </Callout.Root>
                )}

                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Current password
                  </Text>
                  <TextField.Root
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    size="2"
                  />
                </label>

                <Separator size="4" />

                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    New password
                  </Text>
                  <TextField.Root
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    size="2"
                    minLength={8}
                    maxLength={128}
                  />
                </label>

                <PasswordStrength password={newPassword} />

                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Confirm new password
                  </Text>
                  <TextField.Root
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    size="2"
                  />
                  {confirmNewPassword && !passwordsMatch && (
                    <Text size="1" color="red" mt="1">
                      Passwords do not match
                    </Text>
                  )}
                </label>

                <Button type="submit" disabled={isLoading || !passwordsMatch} size="2">
                  {isLoading ? <Spinner size="2" /> : null}
                  {isLoading ? 'Changing...' : 'Change password'}
                </Button>
              </Flex>
            </form>
          </Card>
        ) : (
          <Card size="3">
            <Flex direction="column" gap="2">
              <Heading size="4">Password</Heading>
              <Text size="2" color="gray">
                Your account uses OAuth authentication. Password management is not available for
                OAuth accounts.
              </Text>
            </Flex>
          </Card>
        )}
      </Flex>
    </Container>
  );
}
