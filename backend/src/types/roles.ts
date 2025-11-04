/**
 * @file Role constants and types for ChainEquity backend
 * @notice Matches contract role definitions in IRoles.sol for consistency
 */

/**
 * User roles in the ChainEquity system
 * - admin: Can manage system-wide settings (off-chain only)
 * - issuer: Can mint and approve wallets (on-chain = owner, off-chain = issuer role)
 * - investor: Can hold and transfer tokens (off-chain validation)
 */
export type UserRole = 'admin' | 'issuer' | 'investor';

/**
 * Role constants matching contract definitions
 * These are string values for backend use (contracts use bytes32 hashes)
 */
export const ROLE_ISSUER = 'issuer' as const;
export const ROLE_INVESTOR = 'investor' as const;
export const ROLE_ADMIN = 'admin' as const;

/**
 * All valid role values
 */
export const VALID_ROLES: readonly UserRole[] = [ROLE_ADMIN, ROLE_ISSUER, ROLE_INVESTOR] as const;

/**
 * Check if a string is a valid role
 */
export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}

