import { useNavigate } from 'react-router-dom';
import { Container, Heading, Text, Flex, Separator, Card, Link as RadixLink } from '@radix-ui/themes';
import { LoginButton, EmailLoginForm } from '../components/auth';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithEmail } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleEmailLogin = async (email: string, password: string) => {
    await loginWithEmail(email, password);
    navigate('/');
  };

  return (
    <Container size="1" py="9">
      <Card size="4">
        <Flex direction="column" gap="5">
          <Flex direction="column" gap="2" align="center">
            <Heading size="5">Sign in to Echo Portal</Heading>
            <Text size="2" color="gray">
              Choose your preferred sign-in method
            </Text>
          </Flex>

          {/* OAuth providers */}
          <Flex direction="column" gap="2">
            <LoginButton provider="github" fullWidth />
            <LoginButton provider="google" fullWidth />
          </Flex>

          {/* Divider */}
          <Flex align="center" gap="3">
            <Separator size="4" style={{ flex: 1 }} />
            <Text size="1" color="gray">
              OR
            </Text>
            <Separator size="4" style={{ flex: 1 }} />
          </Flex>

          {/* Email login */}
          <EmailLoginForm
            onSubmit={handleEmailLogin}
            onForgotPassword={() => navigate('/forgot-password')}
          />

          <Flex justify="center" gap="1">
            <Text size="2" color="gray">
              Don't have an account?
            </Text>
            <RadixLink size="2" onClick={() => navigate('/signup')} style={{ cursor: 'pointer' }}>
              Sign up
            </RadixLink>
          </Flex>
        </Flex>
      </Card>
    </Container>
  );
}
