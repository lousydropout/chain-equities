/**
 * @file Authentication types and constants for ChainEquity frontend
 * @notice Demo mode: Mock authentication types matching backend
 *
 * @note Post-Demo: These types will be used with Firebase Auth integration
 */

/**
 * User role type matching backend
 */
export type UserRole = 'admin' | 'issuer' | 'investor';

/**
 * Authentication context matching backend AuthContext interface
 */
export interface AuthContext {
  uid: string;
  email: string;
  role: UserRole;
  wallet_address?: string;
}

/**
 * Demo users for testing different roles
 * @notice Demo mode: Predefined users for testing access control
 */
export const DEMO_USERS: Record<string, AuthContext> = {
  admin: {
    uid: 'admin-user',
    email: 'admin@chainequity.com',
    role: 'admin',
  },
  alice: {
    uid: 'alice-user',
    email: 'alice@chainequity.com',
    role: 'investor',
  },
  bob: {
    uid: 'bob-user',
    email: 'bob@chainequity.com',
    role: 'investor',
  },
  charlie: {
    uid: 'charlie-user',
    email: 'charlie@chainequity.com',
    role: 'investor',
  },
};

/**
 * Get demo user by email or username
 * @param identifier - Email address or username (admin, alice, bob, charlie)
 * @returns Demo user or null if not found
 */
export function getDemoUser(identifier: string): AuthContext | null {
  // Check if identifier is a username key
  const lowerId = identifier.toLowerCase();
  if (DEMO_USERS[lowerId]) {
    return DEMO_USERS[lowerId];
  }

  // Check if identifier is an email
  const user = Object.values(DEMO_USERS).find(
    u => u.email.toLowerCase() === lowerId
  );
  return user || null;
}

/**
 * Default demo user (for backward compatibility)
 * @deprecated Use getDemoUser() or DEMO_USERS instead
 */
export const DEMO_USER: AuthContext = DEMO_USERS.alice;
