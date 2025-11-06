/**
 * @file Protected route component for ChainEquity frontend
 * @notice Handles authentication, role-based, and wallet-based access control
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';
import type { UserRole } from '@/types/auth';

/**
 * ProtectedRoute component props
 */
interface ProtectedRouteProps {
  children: ReactNode;
  /** Required user role for access */
  requiredRole?: UserRole;
  /** Whether wallet connection is required */
  requireWallet?: boolean;
  /** Redirect path for unauthenticated users (default: '/login') */
  redirectTo?: string;
}

/**
 * ProtectedRoute component
 * Checks authentication status, role, and wallet connection
 * Redirects appropriately if conditions are not met
 */
export function ProtectedRoute({
  children,
  requiredRole,
  requireWallet = false,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isConnected, isConnecting } = useAccount();
  const navigate = useNavigate();

  // Check if wallet status is loading
  const isWalletLoading = requireWallet && isConnecting;
  const isChecking = isLoading || isWalletLoading;

  useEffect(() => {
    // Wait for loading to complete before checking conditions
    if (isChecking) {
      return;
    }

    // Check authentication
    if (!isAuthenticated) {
      navigate(redirectTo, { replace: true });
      return;
    }

    // Check role requirement
    if (requiredRole && user?.role !== requiredRole) {
      navigate('/', { replace: true });
      return;
    }

    // Check wallet requirement
    if (requireWallet && !isConnected) {
      navigate('/', { replace: true });
      return;
    }
  }, [
    isAuthenticated,
    isLoading,
    isChecking,
    requiredRole,
    user?.role,
    requireWallet,
    isConnected,
    isConnecting,
    navigate,
    redirectTo,
  ]);

  // Show loading state while checking authentication or wallet status
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  // Show nothing if role doesn't match (redirect will happen)
  if (requiredRole && user?.role !== requiredRole) {
    return null;
  }

  // Show nothing if wallet required but not connected (redirect will happen)
  if (requireWallet && !isConnected) {
    return null;
  }

  // Render children if all conditions are met
  return <>{children}</>;
}

