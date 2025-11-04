/**
 * @file Unified authentication middleware for ChainEquity backend
 * @notice Handles Firebase JWT verification, wallet signature verification, and role-based access control
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyMessage } from 'viem';
import { Database } from 'bun:sqlite';
import { getUserByUid } from '../services/db/users';
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
 * Firebase Admin auth instance (to be initialized by firebase service)
 * This will be set when Firebase Admin is configured
 */
let firebaseAuth: any = null;

/**
 * Initialize Firebase Auth instance (called from firebase service)
 */
export function setFirebaseAuth(authInstance: any) {
  firebaseAuth = authInstance;
}

/**
 * Database instance (to be set by application initialization)
 */
let db: Database | null = null;

/**
 * Set database instance for user lookups
 */
export function setDatabase(database: Database) {
  db = database;
}

/**
 * Unified authentication middleware for Fastify
 * - Verifies Firebase ID token
 * - Fetches user role from database
 * - Attaches user context to request
 * 
 * @param req Fastify request
 * @param reply Fastify reply
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Check for Authorization header
    const header = req.headers.authorization;
    if (!header) {
      return reply.code(401).send({ error: 'Missing Authorization header' });
    }

    // Extract and verify Firebase JWT token
    const token = header.replace('Bearer ', '');
    
    if (!firebaseAuth) {
      return reply.code(500).send({ 
        error: 'Firebase Auth not initialized',
        message: 'Firebase Admin SDK must be configured before using auth middleware'
      });
    }

    const decoded = await firebaseAuth.verifyIdToken(token);

    // Fetch user role from database
    if (!db) {
      return reply.code(500).send({ 
        error: 'Database not initialized',
        message: 'Database must be initialized before using auth middleware'
      });
    }

    const userRecord = getUserByUid(db, decoded.uid);

    // If user doesn't exist in database, create with default investor role
    // This handles first-time login after Firebase authentication
    if (!userRecord) {
      // Note: In production, you might want to handle this differently
      // (e.g., require explicit user creation via admin endpoint)
      return reply.code(403).send({ 
        error: 'User not found',
        message: 'User must be created in database before accessing API'
      });
    }

    // Attach user context with role from database
    req.user = {
      uid: decoded.uid,
      email: decoded.email || userRecord.email,
      role: userRecord.role,
      wallet_address: userRecord.wallet_address || undefined,
    } as AuthContext;
  } catch (err: any) {
    reply.code(401).send({ 
      error: 'Unauthorized', 
      message: err.message 
    });
  }
}

/**
 * Optional wallet verification step for sensitive routes
 * e.g., issuing or transferring shares
 * Requires that the user has linked a wallet address
 * 
 * @param req Fastify request
 * @param reply Fastify reply
 */
export async function requireWalletSignature(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = req.body as { message?: string; signature?: `0x${string}` };
  const { message, signature } = body;
  const expectedAddress = req.user?.wallet_address;

  if (!expectedAddress) {
    return reply.code(400).send({ 
      error: 'No wallet linked to this account' 
    });
  }

  if (!message || !signature) {
    return reply.code(400).send({ 
      error: 'Missing message or signature' 
    });
  }

  try {
    const recovered = await verifyMessage({
      message,
      signature,
      address: expectedAddress as `0x${string}`,
    });

    if (!recovered) {
      return reply.code(403).send({ 
        error: 'Invalid wallet signature' 
      });
    }
  } catch (err: any) {
    return reply.code(403).send({ 
      error: 'Wallet signature verification failed',
      message: err.message 
    });
  }
}

/**
 * Role-based access control helper
 * Returns a middleware function that checks user role
 * 
 * @param role Required role
 * @returns Middleware function
 */
export function requireRole(role: UserRole) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      return reply.code(401).send({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }

    if (req.user.role !== role) {
      return reply.code(403).send({ 
        error: 'Forbidden',
        message: `Requires ${role} role. Current role: ${req.user.role}` 
      });
    }
  };
}

/**
 * Alternative: require any of multiple roles
 * 
 * @param roles Array of allowed roles
 * @returns Middleware function
 */
export function requireAnyRole(roles: UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      return reply.code(401).send({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return reply.code(403).send({ 
        error: 'Forbidden',
        message: `Requires one of: ${roles.join(', ')}. Current role: ${req.user.role}` 
      });
    }
  };
}

