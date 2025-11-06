/**
 * @file Wallet linking routes for ChainEquity backend
 * @notice Endpoints for linking and unlinking wallet addresses to user accounts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { connect } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { unlinkWallet, linkWallet, getUserByUid, getUsersWithLinkedWallets, createUser } from '../services/db/users';
import { isAddress } from 'viem';

/**
 * Request body type for wallet link endpoint
 */
interface LinkWalletBody {
  walletAddress: string;
}

/**
 * Wallet linking routes plugin
 */
export async function walletRoutes(app: FastifyInstance) {
  /**
   * POST /api/wallet/link
   * Link a wallet address to the authenticated user
   */
  app.post<{ Body: LinkWalletBody }>(
    '/wallet/link',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { walletAddress } = request.body;

      // Validate wallet address
      if (!walletAddress || typeof walletAddress !== 'string') {
        return reply.code(400).send({
          error: 'Invalid request',
          message: 'walletAddress is required',
        });
      }

      if (!isAddress(walletAddress)) {
        return reply.code(400).send({
          error: 'Invalid address',
          message: 'walletAddress must be a valid Ethereum address',
        });
      }

      try {
        const db = connect();
        
        // In demo mode, auto-create user if they don't exist
        let userRecord = getUserByUid(db, user.uid);
        if (!userRecord) {
          // Auto-create user for demo mode
          createUser(db, {
            uid: user.uid,
            email: user.email,
            displayName: user.email,
            role: user.role,
          });
          userRecord = getUserByUid(db, user.uid);
        }

        if (!userRecord) {
          return reply.code(500).send({
            error: 'Internal server error',
            message: 'Failed to create or retrieve user',
          });
        }

        const updatedUser = linkWallet(db, user.uid, walletAddress);

        if (!updatedUser) {
          return reply.code(404).send({
            error: 'User not found',
            message: 'User account not found',
          });
        }

        return reply.send({
          success: true,
          message: 'Wallet linked successfully',
          walletAddress: updatedUser.walletAddress || '',
        });
      } catch (error) {
        request.log.error({ error }, 'Error linking wallet');
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to link wallet',
        });
      }
    }
  );

  /**
   * POST /api/wallet/unlink
   * Unlink the wallet address from the authenticated user
   */
  app.post(
    '/wallet/unlink',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user;
      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      try {
        const db = connect();
        
        // Check if user has a linked wallet
        const currentUser = getUserByUid(db, user.uid);
        
        // In demo mode, if user doesn't exist, return success (no wallet to unlink)
        if (!currentUser) {
          return reply.send({
            success: true,
            message: 'Wallet unlinked successfully',
          });
        }

        if (!currentUser.walletAddress) {
          return reply.code(400).send({
            error: 'No wallet linked',
            message: 'No wallet address is currently linked to this account',
          });
        }

        const updatedUser = unlinkWallet(db, user.uid);

        if (!updatedUser) {
          return reply.code(500).send({
            error: 'Internal server error',
            message: 'Failed to unlink wallet',
          });
        }

        return reply.send({
          success: true,
          message: 'Wallet unlinked successfully',
        });
      } catch (error) {
        request.log.error({ error }, 'Error unlinking wallet');
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to unlink wallet',
        });
      }
    }
  );

  /**
   * GET /api/wallet/status
   * Get the current wallet linking status for the authenticated user
   */
  app.get(
    '/wallet/status',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user;
      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      try {
        const db = connect();
        const userRecord = getUserByUid(db, user.uid);

        // In demo mode, if user doesn't exist in DB, return empty wallet status
        // This allows the frontend to work even if users aren't seeded yet
        if (!userRecord) {
          // Demo mode: Return empty wallet status instead of 404
          // Post-demo: This should return 404 or auto-create user
          return reply.send({
            walletAddress: null,
            isLinked: false,
          });
        }

        return reply.send({
          walletAddress: userRecord.walletAddress || null,
          isLinked: !!userRecord.walletAddress,
        });
      } catch (error) {
        request.log.error({ error }, 'Error getting wallet status');
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to get wallet status',
        });
      }
    }
  );

  /**
   * GET /api/wallet/investors
   * Get list of investors with linked wallets (for dropdown selection)
   */
  app.get(
    '/wallet/investors',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const db = connect();
        // Get only investors with linked wallets
        const investors = getUsersWithLinkedWallets(db, 'investor');

        return reply.send({
          investors: investors.map((user) => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email,
            walletAddress: user.walletAddress,
          })),
        });
      } catch (error) {
        request.log.error({ error }, 'Error getting investors with wallets');
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to get investors list',
        });
      }
    }
  );
}

