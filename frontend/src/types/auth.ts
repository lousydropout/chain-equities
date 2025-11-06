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
 * Demo user constant matching backend DEMO_USER
 * @notice Always returns issuer role for demo purposes
 */
export const DEMO_USER: AuthContext = {
  uid: 'demo-user',
  email: 'demo@example.com',
  role: 'issuer',
};
