/**
 * @file useAuth hook for accessing authentication context
 * @notice Demo mode: Hook for mock authentication
 *
 * @note Post-Demo: This will work with Firebase Auth integration
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * useAuth hook - provides access to authentication context
 * @returns Auth context value with user, isAuthenticated, isLoading, login, logout
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
