/**
 * @file Authentication context for ChainEquity frontend
 * @notice Demo mode: Mock authentication with localStorage persistence
 *
 * @note Post-Demo: This will be replaced with Firebase Auth integration
 */

import {
  createContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { AuthContext as AuthContextType } from '../types/auth';
import { DEMO_USER } from '../types/auth';
import {
  getAuthUser,
  setAuthUser,
  removeAuthUser,
  setAuthToken,
  removeAuthToken,
} from '../lib/auth';

/**
 * Auth context value interface
 */
interface AuthContextValue {
  user: AuthContextType | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

/**
 * Create auth context
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider component props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component
 * Manages authentication state and provides auth context to children
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthContextType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load auth state from localStorage on mount
   */
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const storedUser = getAuthUser();
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as AuthContextType;
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Failed to load auth state from localStorage:', error);
        // Clear invalid data
        removeAuthUser();
        removeAuthToken();
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, []);

  /**
   * Simulate login - sets demo user
   * @note Post-Demo: Replace with Firebase Auth signIn
   */
  const login = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Simulate async operation (e.g., API call)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Set demo user
      setUser(DEMO_USER);

      // Persist to localStorage
      setAuthUser(JSON.stringify(DEMO_USER));
      // Set a mock token for API calls
      setAuthToken('demo-token');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout - clears auth state
   * @note Post-Demo: Replace with Firebase Auth signOut
   */
  const logout = (): void => {
    setUser(null);
    removeAuthUser();
    removeAuthToken();
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Export AuthContext for use in useAuth hook
 */
export { AuthContext };
