/**
 * @file Unified authentication middleware for ChainEquity backend
 * @notice Demo mode: Mock authentication returning demo user with issuer role
 * 
 * @note Post-Demo: This will be replaced with Firebase JWT verification and real user management
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '../types/roles';

/**
 * Authentication context attached to authenticated requests
 */
export interface AuthContext {
  uid: string;
  email: string;
  role: UserRole;
  wallet_address?: string;
}

// Extend FastifyRequest to include user context
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthContext;
  }
}

/**
 * Demo user constant - always returns issuer role for demo purposes
 * @note Post-Demo: This will be replaced with real Firebase JWT verification
 */
const DEMO_USER: AuthContext = {
  uid: 'demo-user',
  email: 'demo@example.com',
  role: 'issuer',
};

/**
 * Mock authentication middleware for demo
 * Returns a hardcoded demo user with issuer role
 * No JWT verification or database lookups required
 * 
 * TODO: Replace mock auth with Firebase Admin verification after demo phase.
 * 
 * @param req Fastify request
 * @param reply Fastify reply
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Check for Authorization header to maintain consistent API behavior
  const header = req.headers.authorization;
  if (!header) {
    return reply.code(401).send({ 
      error: 'Missing Authorization header',
      message: 'Authorization header is required'
    });
  }

  // In demo mode, extract user info from custom headers sent by frontend
  const userUid = req.headers['x-user-uid'] as string | undefined;
  const userEmail = req.headers['x-user-email'] as string | undefined;
  const userRole = req.headers['x-user-role'] as string | undefined;

  if (userUid && userEmail && userRole) {
    // Use user info from headers (demo mode)
    req.user = {
      uid: userUid,
      email: userEmail,
      role: userRole as UserRole,
    };
  } else {
    // Fallback to demo user if headers not present
  req.user = DEMO_USER;
  }
}

/**
 * Optional wallet verification step for sensitive routes
 * e.g., issuing or transferring shares
 * 
 * TODO: Implement wallet signature verification after demo phase.
 * For demo, this middleware allows all requests to pass through.
 * 
 * @param req Fastify request
 * @param reply Fastify reply
 */
export async function requireWalletSignature(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Demo mode: Allow all requests without signature verification
  // Post-demo: Verify signed message against linked wallet address
  return;
}

/**
 * Role-based access control helper
 * Returns a middleware function that checks user role
 * 
 * TODO: Implement strict role checking after demo phase.
 * For demo, this middleware allows all requests to pass through.
 * 
 * @param role Required role (not enforced in demo mode)
 * @returns Middleware function
 */
export function requireRole(role: UserRole) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Demo mode: Allow all requests without role checking
    // Post-demo: Verify user has required role from database
    return;
  };
}

/**
 * Alternative: require any of multiple roles
 * 
 * TODO: Implement strict role checking after demo phase.
 * For demo, this middleware allows all requests to pass through.
 * 
 * @param roles Array of allowed roles (not enforced in demo mode)
 * @returns Middleware function
 */
export function requireAnyRole(roles: UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Demo mode: Allow all requests without role checking
    // Post-demo: Verify user has one of the required roles from database
    return;
  };
}


