import { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';

interface LogoutButtonProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'text';
  showIcon?: boolean;
}

const LogoutIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const sizeMap = {
  sm: '1' as const,
  md: '2' as const,
  lg: '3' as const,
};

// Map old variants to Radix variants
const variantMap = {
  primary: 'solid' as const,
  secondary: 'soft' as const,
  text: 'ghost' as const,
};

export function LogoutButton({
  size = 'md',
  variant = 'secondary',
  showIcon = true,
}: LogoutButtonProps) {
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      // Redirect to home or login page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoading}
      variant={variantMap[variant]}
      color="red"
      size={sizeMap[size]}
    >
      {isLoading ? <LoadingSpinner /> : showIcon ? <LogoutIcon /> : null}
      <span>{isLoading ? 'Signing out...' : 'Sign out'}</span>
    </Button>
  );
}

export default LogoutButton;
