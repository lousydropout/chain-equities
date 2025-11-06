/**
 * @file Shareholders API routes
 * @notice REST endpoints for querying shareholder information and cap table
 * 
 * Contract function mapping:
 * - balanceOf(address) view returns (uint256)
 * - effectiveBalanceOf(address) view returns (uint256)
 * - totalSupply() view returns (uint256)
 * - splitFactor() view returns (uint256)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getPublicClient } from "../services/chain/client";
import { CONTRACTS } from "../config/contracts";
import { safeRead } from "../services/chain/utils";
import { query, queryOne, connect } from "../db/index";
import { isAddress } from "viem";
import type { Address } from "viem";
import { getUsersWithLinkedWallets, getUserByUid } from "../services/db/users";
import { requireAuth } from '../middleware/auth';

/**
 * Cache for totalSupply and splitFactor (5-second TTL)
 */
let cachedSupply: bigint | null = null;
let cachedSplitFactor: bigint | null = null;
let lastFetch = 0;
const CACHE_TTL = 5000; // 5 seconds

/**
 * Reset cache (useful for testing)
 * @internal
 */
export function resetCache(): void {
  cachedSupply = null;
  cachedSplitFactor = null;
  lastFetch = 0;
}

/**
 * Get cached totalSupply and splitFactor from contract
 * Refreshes cache if it's older than CACHE_TTL
 */
async function getCachedSupply(): Promise<{
  supply: bigint;
  splitFactor: bigint;
  totalEffectiveSupply: bigint;
}> {
  const now = Date.now();
  const publicClient = getPublicClient();
  const { address, abi } = CONTRACTS.token;

  if (!cachedSupply || !cachedSplitFactor || now - lastFetch > CACHE_TTL) {
    const supply = await safeRead<bigint>(publicClient, {
      address,
      abi,
      functionName: "totalSupply",
    });

    const factor = await safeRead<bigint>(publicClient, {
      address,
      abi,
      functionName: "splitFactor",
    });

    if (supply === null || factor === null) {
      throw new Error("Failed to read totalSupply or splitFactor from contract");
    }

    cachedSupply = supply;
    cachedSplitFactor = factor;
    lastFetch = now;
  }

  // Calculate total effective supply: totalSupply * splitFactor / 1e18
  const totalEffectiveSupply =
    (cachedSupply * cachedSplitFactor) / BigInt(10 ** 18);

  return {
    supply: cachedSupply,
    splitFactor: cachedSplitFactor,
    totalEffectiveSupply,
  };
}

/**
 * Calculate ownership percentage with safe BigInt math
 * Returns number with 2 decimal precision
 */
function calculateOwnershipPercentage(
  effectiveBalance: bigint,
  totalEffectiveSupply: bigint
): number {
  if (totalEffectiveSupply === 0n) {
    return 0;
  }

  // Use integer math: (effectiveBalance * 10000) / totalEffectiveSupply, then divide by 100
  const percentage = Number(
    (effectiveBalance * 10000n) / totalEffectiveSupply
  ) / 100;

  return percentage;
}

/**
 * Convert database row to shareholder response object
 */
function asShareholderResponse(
  row: {
    address: string;
    balance: string;
    effectiveBalance: string;
    lastUpdatedBlock: number;
  },
  totalEffectiveSupply: bigint
): {
  address: string;
  balance: string;
  effectiveBalance: string;
  ownershipPercentage: number;
  lastUpdatedBlock: number;
} {
  const effectiveBalance = BigInt(row.effectiveBalance);
  const ownership = calculateOwnershipPercentage(
    effectiveBalance,
    totalEffectiveSupply
  );

  return {
    address: row.address,
    balance: row.balance,
    effectiveBalance: row.effectiveBalance,
    ownershipPercentage: ownership,
    lastUpdatedBlock: row.lastUpdatedBlock,
  };
}

/**
 * GET /api/shareholders
 * Returns paginated list of all shareholders (cap table)
 */
async function getShareholders(
  request: FastifyRequest<{
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Parse and validate pagination parameters
    const limit = Math.min(
      Math.max(1, parseInt(request.query.limit || "50", 10)),
      100
    );
    const offset = Math.max(0, parseInt(request.query.offset || "0", 10));

    // Get total count
    const totalResult = queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM shareholders"
    );
    const total = totalResult?.count || 0;

    // Query shareholders from database (ordered by effective balance DESC)
    const rows = query<{
      address: string;
      balance: string;
      effectiveBalance: string;
      lastUpdatedBlock: number;
    }>(
      `SELECT 
        address, 
        balance, 
        effective_balance AS effectiveBalance, 
        last_updated_block AS lastUpdatedBlock
      FROM shareholders
      ORDER BY effective_balance DESC
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Get cached supply data
    const { supply, splitFactor, totalEffectiveSupply } =
      await getCachedSupply();

    // Transform rows to response format
    const shareholders = rows.map((row) =>
      asShareholderResponse(row, totalEffectiveSupply)
    );

    reply.send({
      shareholders,
      pagination: {
        limit,
        offset,
        total,
      },
      totalSupply: supply.toString(),
      totalEffectiveSupply: totalEffectiveSupply.toString(),
    });
  } catch (error) {
    request.log.error(error, "Error fetching shareholders");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch shareholders",
    });
  }
}

/**
 * GET /api/shareholders/:address
 * Returns detailed information for a specific shareholder
 */
async function getShareholder(
  request: FastifyRequest<{
    Params: {
      address: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { address } = request.params;

    // Validate address format using viem
    if (!isAddress(address)) {
      reply.code(400).send({
        error: "Invalid address format",
        message: "Address must be a valid Ethereum address",
      });
      return;
    }

    const publicClient = getPublicClient();
    const { address: tokenAddress, abi } = CONTRACTS.token;
    const normalizedAddress = address.toLowerCase() as Address;

    // Query contract for real-time balances
    const [balance, effectiveBalance] = await Promise.all([
      safeRead<bigint>(publicClient, {
        address: tokenAddress,
        abi,
        functionName: "balanceOf",
        args: [normalizedAddress],
      }),
      safeRead<bigint>(publicClient, {
        address: tokenAddress,
        abi,
        functionName: "effectiveBalanceOf",
        args: [normalizedAddress],
      }),
    ]);

    // Check if shareholder exists (has balance)
    if (!balance || balance === 0n) {
      reply.code(404).send({
        error: "Shareholder not found",
        message: `No balance found for address ${address}`,
      });
      return;
    }

    // Get cached supply data for ownership percentage
    const { totalEffectiveSupply } = await getCachedSupply();

    // Query database for last_updated_block (optional, may not exist if not indexed yet)
    let lastUpdatedBlock: number | null = null;
    try {
      const dbRow = queryOne<{
        lastUpdatedBlock: number;
      }>(
        `SELECT last_updated_block AS lastUpdatedBlock
         FROM shareholders
         WHERE address = ?`,
        [normalizedAddress]
      );
      lastUpdatedBlock = dbRow?.lastUpdatedBlock || null;
    } catch (dbError) {
      // Database query is optional, continue without lastUpdatedBlock
      request.log.warn(dbError, "Failed to query lastUpdatedBlock from database");
    }

    // Calculate ownership percentage
    const ownershipPercentage = calculateOwnershipPercentage(
      effectiveBalance || 0n,
      totalEffectiveSupply
    );

    reply.send({
      address: normalizedAddress,
      balance: balance.toString(),
      effectiveBalance: (effectiveBalance || 0n).toString(),
      ownershipPercentage,
      lastUpdatedBlock,
    });
  } catch (error) {
    request.log.error(error, "Error fetching shareholder");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch shareholder information",
    });
  }
}

/**
 * GET /api/shareholders/me
 * Returns shareholder information for the authenticated user's linked wallet
 * This endpoint queries by user ID (foundational), not wallet address
 */
async function getMyShareholder(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
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

    // If user doesn't exist or has no linked wallet, return 404
    if (!userRecord || !userRecord.walletAddress) {
      return reply.code(404).send({
        error: 'Wallet not linked',
        message: 'No wallet address is linked to your account. Please link a wallet first.',
      });
    }

    // Use the existing getShareholder logic but with the linked wallet address
    const publicClient = getPublicClient();
    const { address: tokenAddress, abi } = CONTRACTS.token;
    const normalizedAddress = userRecord.walletAddress.toLowerCase() as Address;

    // Query contract for real-time balances
    const [balance, effectiveBalance] = await Promise.all([
      safeRead<bigint>(publicClient, {
        address: tokenAddress,
        abi,
        functionName: "balanceOf",
        args: [normalizedAddress],
      }),
      safeRead<bigint>(publicClient, {
        address: tokenAddress,
        abi,
        functionName: "effectiveBalanceOf",
        args: [normalizedAddress],
      }),
    ]);

    // Get cached supply data for ownership percentage
    const { totalEffectiveSupply } = await getCachedSupply();

    // Query database for last_updated_block
    let lastUpdatedBlock: number | null = null;
    try {
      const dbRow = queryOne<{
        lastUpdatedBlock: number;
      }>(
        `SELECT last_updated_block AS lastUpdatedBlock
         FROM shareholders
         WHERE address = ?`,
        [normalizedAddress]
      );
      lastUpdatedBlock = dbRow?.lastUpdatedBlock || null;
    } catch (dbError) {
      request.log.warn(dbError, "Failed to query lastUpdatedBlock from database");
    }

    // Calculate ownership percentage
    const ownershipPercentage = calculateOwnershipPercentage(
      effectiveBalance || 0n,
      totalEffectiveSupply
    );

    reply.send({
      address: normalizedAddress,
      balance: (balance || 0n).toString(),
      effectiveBalance: (effectiveBalance || 0n).toString(),
      ownershipPercentage,
      lastUpdatedBlock,
    });
  } catch (error) {
    request.log.error(error, "Error fetching my shareholder info");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch shareholder information",
    });
  }
}

/**
 * GET /api/shareholders/pending
 * Returns list of investors with linked wallets that are not approved on contract
 */
async function getPendingApprovals(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const db = connect();
    const publicClient = getPublicClient();
    const { address: tokenAddress, abi } = CONTRACTS.token;

    // Get all investors with linked wallets
    const investors = getUsersWithLinkedWallets(db, "investor");

    // Check approval status for each investor's wallet
    const pendingApprovals = [];
    for (const investor of investors) {
      if (!investor.walletAddress) {
        continue; // Skip if no wallet address (shouldn't happen, but safety check)
      }

      // Validate wallet address format
      if (!isAddress(investor.walletAddress)) {
        request.log.warn(
          { walletAddress: investor.walletAddress },
          "Invalid wallet address format for investor"
        );
        continue;
      }

      // Check contract approval status
      const isApproved = await safeRead<boolean>(publicClient, {
        address: tokenAddress,
        abi,
        functionName: "isApproved",
        args: [investor.walletAddress.toLowerCase() as Address],
      });

      // If approval check failed or wallet is not approved, add to pending list
      if (isApproved === null || isApproved === false) {
        pendingApprovals.push({
          uid: investor.uid,
          email: investor.email,
          displayName: investor.displayName || investor.email,
          walletAddress: investor.walletAddress,
          isApproved: false,
        });
      }
    }

    reply.send({
      pending: pendingApprovals,
    });
  } catch (error) {
    request.log.error(error, "Error fetching pending approvals");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch pending approvals",
    });
  }
}

/**
 * Register shareholders routes with Fastify instance
 */
export async function shareholdersRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Response schema for shareholder object
  const shareholderSchema = {
    type: "object",
    properties: {
      address: { type: "string" },
      balance: { type: "string" },
      effectiveBalance: { type: "string" },
      ownershipPercentage: { type: "number" },
      lastUpdatedBlock: { type: ["integer", "null"] },
    },
    required: ["address", "balance", "effectiveBalance", "ownershipPercentage"],
  };

  // Response schema for GET /api/shareholders
  const shareholdersListSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          shareholders: {
            type: "array",
            items: shareholderSchema,
          },
          pagination: {
            type: "object",
            properties: {
              limit: { type: "integer" },
              offset: { type: "integer" },
              total: { type: "integer" },
            },
            required: ["limit", "offset", "total"],
          },
          totalSupply: { type: "string" },
          totalEffectiveSupply: { type: "string" },
        },
        required: [
          "shareholders",
          "pagination",
          "totalSupply",
          "totalEffectiveSupply",
        ],
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  };

  // Response schema for GET /api/shareholders/:address
  const shareholderDetailSchema = {
    response: {
      200: shareholderSchema,
      400: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
      404: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  };

  // Response schema for GET /api/shareholders/pending
  const pendingApprovalsSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          pending: {
            type: "array",
            items: {
              type: "object",
              properties: {
                uid: { type: "string" },
                email: { type: "string" },
                displayName: { type: "string" },
                walletAddress: { type: "string" },
                isApproved: { type: "boolean" },
              },
              required: ["uid", "email", "displayName", "walletAddress", "isApproved"],
            },
          },
        },
        required: ["pending"],
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  };

  // Register specific routes before parameterized routes to avoid conflicts
  // Fastify matches routes in registration order, so /me must come before /:address
  fastify.get("/shareholders", { schema: shareholdersListSchema }, getShareholders);
  fastify.get(
    "/shareholders/pending",
    { schema: pendingApprovalsSchema },
    getPendingApprovals
  );
  // Register /me route with explicit path to ensure it's matched before /:address
  fastify.get(
    "/shareholders/me",
    { 
      preHandler: requireAuth,
      schema: shareholderDetailSchema 
    },
    getMyShareholder
  );
  // Register parameterized route last to avoid matching "me" as an address
  fastify.get(
    "/shareholders/:address",
    { schema: shareholderDetailSchema },
    getShareholder
  );
}

