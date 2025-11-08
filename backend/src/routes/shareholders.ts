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
import type { MetaRecord } from "../db/schema";

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
async function getCachedSupply(blockTag?: number): Promise<{
  supply: bigint;
  splitFactor: bigint;
  totalEffectiveSupply: bigint;
}> {
  const publicClient = getPublicClient();
  const { address, abi } = CONTRACTS.token;

  // If blockTag is provided, always query at that block (no caching)
  if (blockTag !== undefined) {
    const supply = await safeRead<bigint>(publicClient, {
      address,
      abi,
      functionName: "totalSupply",
      blockNumber: BigInt(blockTag),
    });

    const factor = await safeRead<bigint>(publicClient, {
      address,
      abi,
      functionName: "splitFactor",
      blockNumber: BigInt(blockTag),
    });

    if (supply === null || factor === null) {
      throw new Error("Failed to read totalSupply or splitFactor from contract");
    }

    // Calculate total effective supply: totalSupply * splitFactor / 1e18
    const totalEffectiveSupply =
      (supply * factor) / BigInt(10 ** 18);

    return {
      supply,
      splitFactor: factor,
      totalEffectiveSupply,
    };
  }

  // Otherwise use cache for latest block
  const now = Date.now();
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
    email?: string | null;
    displayName?: string | null;
  },
  totalEffectiveSupply: bigint
): {
  address: string;
  balance: string;
  effectiveBalance: string;
  ownershipPercentage: number;
  lastUpdatedBlock: number;
  email?: string | null;
  displayName?: string | null;
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
    email: row.email ?? null,
    displayName: row.displayName ?? null,
  };
}

/**
 * GET /api/shareholders
 * Returns paginated list of all shareholders (cap table)
 * Supports optional blockNumber parameter for historical snapshots
 */
async function getShareholders(
  request: FastifyRequest<{
    Querystring: {
      limit?: string;
      offset?: string;
      blockNumber?: string;
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

    const publicClient = getPublicClient();
    const { address: tokenAddress, abi } = CONTRACTS.token;
    let blockNumber: number | undefined = undefined;
    
    // Get current block number (always needed for response)
    const currentBlockNumber = await publicClient.getBlockNumber();
    let responseBlockNumber: number = Number(currentBlockNumber);

    // Handle block number parameter
    if (request.query.blockNumber) {
      const requestedBlock = parseInt(request.query.blockNumber, 10);
      
      if (isNaN(requestedBlock) || requestedBlock < 0) {
        // Invalid block number, fall back to latest
        request.log.warn(`Invalid block number: ${request.query.blockNumber}, falling back to latest`);
      } else {
        if (requestedBlock > Number(currentBlockNumber)) {
          // Future block, fall back to latest
          request.log.warn(`Requested block ${requestedBlock} is in the future (current: ${currentBlockNumber}), falling back to latest`);
        } else {
          blockNumber = requestedBlock;
          responseBlockNumber = requestedBlock;
        }
      }
    }

    let shareholders: Array<{
      address: string;
      balance: string;
      effectiveBalance: string;
      ownershipPercentage: number;
      lastUpdatedBlock: number;
      email?: string | null;
      displayName?: string | null;
    }>;
    let total: number;
    let supply: bigint;
    let totalEffectiveSupply: bigint;

    if (blockNumber !== undefined) {
      // Historical snapshot: query contract at specific block
      // Get all unique addresses from transactions up to this block
      const addressRows = query<{ address: string }>(
        `SELECT DISTINCT to_address AS address
         FROM transactions
         WHERE block_number <= ?
         UNION
         SELECT DISTINCT from_address AS address
         FROM transactions
         WHERE block_number <= ? AND from_address IS NOT NULL`,
        [blockNumber, blockNumber]
      );

      const addresses = addressRows
        .map((row) => row.address)
        .filter((addr): addr is string => addr !== null && addr !== "");

      // Query balances at the specified block
      const balancePromises = addresses.map(async (address) => {
        const [balance, effectiveBalance] = await Promise.all([
          safeRead<bigint>(publicClient, {
            address: tokenAddress,
            abi,
            functionName: "balanceOf",
            args: [address.toLowerCase() as Address],
            blockNumber: BigInt(blockNumber),
          }),
          safeRead<bigint>(publicClient, {
            address: tokenAddress,
            abi,
            functionName: "effectiveBalanceOf",
            args: [address.toLowerCase() as Address],
            blockNumber: BigInt(blockNumber),
          }),
        ]);

        return {
          address: address.toLowerCase(),
          balance,
          effectiveBalance,
        };
      });

      const balanceResults = await Promise.all(balancePromises);

      // Filter out addresses with zero balance
      const shareholdersWithBalances = balanceResults
        .filter((result) => result.balance !== null && result.effectiveBalance !== null && result.balance > 0n)
        .map((result) => ({
          address: result.address,
          balance: result.balance!.toString(),
          effectiveBalance: result.effectiveBalance!.toString(),
        }));

      // Get supply data at this block
      const supplyData = await getCachedSupply(blockNumber);
      supply = supplyData.supply;
      totalEffectiveSupply = supplyData.totalEffectiveSupply;

      // Get user data for all addresses (LEFT JOIN with users table)
      const addressList = shareholdersWithBalances.map((sh) => sh.address);
      const userMap = new Map<string, { email: string | null; displayName: string | null }>();
      
      if (addressList.length > 0) {
        const placeholders = addressList.map(() => '?').join(',');
        const userRows = query<{
          walletAddress: string;
          email: string | null;
          displayName: string | null;
        }>(
          `SELECT 
            wallet_address AS walletAddress,
            email,
            display_name AS displayName
          FROM users
          WHERE wallet_address IN (${placeholders})`,
          addressList
        );

        // Create a map of address -> user data for quick lookup
        for (const userRow of userRows) {
          if (userRow.walletAddress) {
            userMap.set(userRow.walletAddress.toLowerCase(), {
              email: userRow.email,
              displayName: userRow.displayName,
            });
          }
        }
      }

      // Calculate ownership percentages and include user data
      shareholders = shareholdersWithBalances.map((sh) => {
        const effectiveBalance = BigInt(sh.effectiveBalance);
        const ownership = calculateOwnershipPercentage(
          effectiveBalance,
          totalEffectiveSupply
        );
        const userData = userMap.get(sh.address) || { email: null, displayName: null };
        return {
          address: sh.address,
          balance: sh.balance,
          effectiveBalance: sh.effectiveBalance,
          ownershipPercentage: ownership,
          lastUpdatedBlock: blockNumber,
          email: userData.email,
          displayName: userData.displayName,
        };
      });

      // Sort by effective balance DESC
      shareholders.sort((a, b) => {
        const aBal = BigInt(a.effectiveBalance);
        const bBal = BigInt(b.effectiveBalance);
        return aBal > bBal ? -1 : aBal < bBal ? 1 : 0;
      });

      total = shareholders.length;

      // Apply pagination
      shareholders = shareholders.slice(offset, offset + limit);
    } else {
      // Latest snapshot: use database
      // Get total count
      const totalResult = queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM shareholders"
      );
      total = totalResult?.count || 0;

      // Query shareholders from database (ordered by effective balance DESC)
      // LEFT JOIN with users to get email and displayName
      const rows = query<{
        address: string;
        balance: string;
        effectiveBalance: string;
        lastUpdatedBlock: number;
        email: string | null;
        displayName: string | null;
      }>(
        `SELECT 
          s.address, 
          s.balance, 
          s.effective_balance AS effectiveBalance, 
          s.last_updated_block AS lastUpdatedBlock,
          u.email,
          u.display_name AS displayName
        FROM shareholders s
        LEFT JOIN users u ON LOWER(s.address) = LOWER(u.wallet_address)
        ORDER BY s.effective_balance DESC
        LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      // Get cached supply data
      const supplyData = await getCachedSupply();
      supply = supplyData.supply;
      totalEffectiveSupply = supplyData.totalEffectiveSupply;

      // Transform rows to response format
      shareholders = rows.map((row) =>
        asShareholderResponse(row, totalEffectiveSupply)
      );
    }

    // Build response
    const response = {
      shareholders,
      pagination: {
        limit,
        offset,
        total,
      },
      totalSupply: supply.toString(),
      totalEffectiveSupply: totalEffectiveSupply.toString(),
      blockNumber: responseBlockNumber,
    };

    reply.send(response);
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

    // Check for reserved route names - these should be handled by other routes
    const reservedWords = ['approved', 'pending', 'me'];
    if (reservedWords.includes(address.toLowerCase())) {
      reply.code(404).send({
        error: "Not found",
        message: `Route /shareholders/${address} not found`,
      });
      return;
    }

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

    // Query database for last_updated_block and user data (optional, may not exist if not indexed yet)
    let lastUpdatedBlock: number | null = null;
    let email: string | null = null;
    let displayName: string | null = null;
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

      // Query user data if available
      const userRow = queryOne<{
        email: string | null;
        displayName: string | null;
      }>(
        `SELECT email, display_name AS displayName
         FROM users
         WHERE LOWER(wallet_address) = LOWER(?)`,
        [normalizedAddress]
      );
      if (userRow) {
        email = userRow.email;
        displayName = userRow.displayName;
      }
    } catch (dbError) {
      // Database query is optional, continue without lastUpdatedBlock/user data
      request.log.warn(dbError, "Failed to query database");
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
      email,
      displayName,
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
      email: userRecord.email,
      displayName: userRecord.displayName,
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
 * GET /api/shareholders/approved
 * Returns list of investors with linked wallets that are approved on contract
 */
async function getApprovedUsers(
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
    const approvedUsers = [];
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

      // If wallet is approved, add to approved list
      if (isApproved === true) {
        approvedUsers.push({
          uid: investor.uid,
          email: investor.email,
          displayName: investor.displayName || investor.email,
          walletAddress: investor.walletAddress,
          isApproved: true,
        });
      }
    }

    reply.send({
      approved: approvedUsers,
    });
  } catch (error) {
    request.log.error(error, "Error fetching approved users");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch approved users",
    });
  }
}

/**
 * GET /api/shareholders/blocks
 * Returns list of distinct block numbers that have transactions
 * Used for navigation between blocks with activity
 */
async function getBlocksWithTransactions(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const blocks = query<{ blockNumber: number }>(
      `SELECT DISTINCT block_number AS blockNumber
       FROM transactions
       ORDER BY block_number ASC`
    );

    reply.send({
      blocks: blocks.map((row) => row.blockNumber),
    });
  } catch (error) {
    request.log.error(error, "Error fetching blocks with transactions");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch blocks with transactions",
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
      email: { type: ["string", "null"] },
      displayName: { type: ["string", "null"] },
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
          blockNumber: { type: "integer" },
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

  // Response schema for GET /api/shareholders/approved
  const approvedUsersSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          approved: {
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
        required: ["approved"],
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

  // Response schema for GET /api/shareholders/blocks
  const blocksSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          blocks: {
            type: "array",
            items: { type: "integer" },
          },
        },
        required: ["blocks"],
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
    "/shareholders/blocks",
    { schema: blocksSchema },
    getBlocksWithTransactions
  );
  fastify.get(
    "/shareholders/pending",
    { schema: pendingApprovalsSchema },
    getPendingApprovals
  );
  fastify.get(
    "/shareholders/approved",
    { schema: approvedUsersSchema },
    getApprovedUsers
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
  // Register parameterized route last to avoid matching "me", "approved", or "pending" as addresses
  // Fastify should match specific routes first, but we also check for reserved words in the handler
  fastify.get(
    "/shareholders/:address",
    { schema: shareholderDetailSchema },
    getShareholder
  );
}

