import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Heading, Text, Flex, Card, Spinner, Button, Callout, TextField } from '@radix-ui/themes';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    verifyEmail(token).then((result) => {
      if (result.success) {
        setStatus('success');
        setMessage(result.message);
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    });
  }, [token, verifyEmail]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendStatus('sending');
    setResendMessage('');
    try {
      await resendVerification(resendEmail);
      setResendStatus('sent');
      setResendMessage('A new verification email has been sent.');
    } catch (err: unknown) {
      setResendStatus('error');
      setResendMessage(err instanceof Error ? err.message : 'Failed to resend');
    }
  };

  const ResendSection = () => (
    <Flex direction="column" gap="2" style={{ width: '100%' }}>
      <Text size="2" color="gray">
        Need a new verification email?
      </Text>
      <Flex gap="2">
        <TextField.Root
          type="email"
          placeholder="Enter your email"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          size="2"
          style={{ flex: 1 }}
        />
        <Button
          variant="soft"
          size="2"
          onClick={handleResend}
          disabled={!resendEmail || resendStatus === 'sending'}
        >
          {resendStatus === 'sending' ? <Spinner size="1" /> : 'Resend'}
        </Button>
      </Flex>
      {resendStatus === 'sent' && (
        <Callout.Root color="green" size="1">
          <Callout.Text>{resendMessage}</Callout.Text>
        </Callout.Root>
      )}
      {resendStatus === 'error' && (
        <Callout.Root color="red" size="1">
          <Callout.Text>{resendMessage}</Callout.Text>
        </Callout.Root>
      )}
    </Flex>
  );

  return (
    <Container size="1" py="9">
      <Card size="4">
        <Flex direction="column" gap="4" align="center">
          {status === 'loading' && (
            <>
              <Spinner size="3" />
              <Heading size="5">Verifying your email...</Heading>
              <Text size="2" color="gray">
                Please wait while we verify your email address.
              </Text>
            </>
          )}

          {status === 'success' && (
            <>
              <Heading size="5">Email verified!</Heading>
              <Callout.Root color="green" size="1">
                <Callout.Text>{message}</Callout.Text>
              </Callout.Root>
              <Button onClick={() => navigate('/login')}>Go to login</Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Heading size="5">Verification failed</Heading>
              <Callout.Root color="red" size="1">
                <Callout.Text>{message}</Callout.Text>
              </Callout.Root>
              <ResendSection />
              <Button variant="soft" onClick={() => navigate('/login')}>
                Back to login
              </Button>
            </>
          )}

          {status === 'no-token' && (
            <>
              <Heading size="5">Invalid verification link</Heading>
              <Text size="2" color="gray">
                This verification link is invalid or missing. Please check your email for the
                correct link.
              </Text>
              <ResendSection />
              <Button variant="soft" onClick={() => navigate('/login')}>
                Back to login
              </Button>
            </>
          )}
        </Flex>
      </Card>
    </Container>
  );
}
