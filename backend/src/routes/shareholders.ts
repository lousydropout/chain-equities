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
 * Get first indexed block number from transactions table
 */
function getFirstIndexedBlock(): number | null {
  const result = queryOne<{ minBlock: number }>(
    "SELECT MIN(block_number) as minBlock FROM transactions"
  );
  return result?.minBlock ?? null;
}

/**
 * Get last indexed block number from meta table
 */
function getLastIndexedBlock(): number | null {
  const meta = queryOne<MetaRecord>(
    "SELECT * FROM meta WHERE key = ?",
    ["last_indexed_block"]
  );
  if (!meta) {
    return null;
  }
  return Number(meta.value);
}

/**
 * Get the next block number with a transaction after the given block
 * Returns null if there are no more transaction blocks
 */
function getNextTransactionBlock(blockNumber: number): number | null {
  const result = queryOne<{ nextBlock: number }>(
    "SELECT MIN(block_number) as nextBlock FROM transactions WHERE block_number > ?",
    [blockNumber]
  );
  return result?.nextBlock ?? null;
}

/**
 * Get the previous block number with a transaction before the given block
 * Returns null if there are no previous transaction blocks
 */
function getPreviousTransactionBlock(blockNumber: number): number | null {
  const result = queryOne<{ prevBlock: number }>(
    "SELECT MAX(block_number) as prevBlock FROM transactions WHERE block_number < ?",
    [blockNumber]
  );
  return result?.prevBlock ?? null;
}

/**
 * Get all unique block numbers that have transactions, ordered ascending
 */
function getAllTransactionBlocks(): number[] {
  const results = query<{ block_number: number }>(
    "SELECT DISTINCT block_number FROM transactions ORDER BY block_number ASC"
  );
  return results.map((row) => row.block_number);
}

/**
 * Clamp block number to valid range [firstBlock, lastBlock]
 * Returns clamped value and warning message if clamping occurred
 */
function clampBlockNumber(
  blockNumber: number
): { blockNumber: number; warning: string | null } {
  const firstBlock = getFirstIndexedBlock();
  const lastBlock = getLastIndexedBlock();

  if (firstBlock === null || lastBlock === null) {
    // No transactions indexed yet, return as-is with warning
    return {
      blockNumber,
      warning: "No transactions indexed yet",
    };
  }

  if (blockNumber < firstBlock) {
    return {
      blockNumber: firstBlock,
      warning: `Block number clamped to first indexed block: ${firstBlock}`,
    };
  }

  if (blockNumber > lastBlock) {
    return {
      blockNumber: lastBlock,
      warning: `Block number clamped to last indexed block: ${lastBlock}`,
    };
  }

  return { blockNumber, warning: null };
}

/**
 * Zero address constant
 */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Historical balance info including balance and last updated block
 */
interface HistoricalBalanceInfo {
  balance: bigint;
  lastUpdatedBlock: number;
}

/**
 * Get historical balances at a specific block number
 * Correctly handles TRANSFER events (decrement from, increment to) and ISSUED events
 * Returns both balance and the last block where each address had a transaction
 */
function getHistoricalBalances(
  blockNumber: number
): Map<string, HistoricalBalanceInfo> {
  // Query all transactions up to the specified block
  const transactions = query<{
    from_address: string | null;
    to_address: string | null;
    amount: string;
    event_type: "ISSUED" | "TRANSFER";
    block_number: number;
  }>(
    `SELECT 
      from_address,
      to_address,
      amount,
      event_type,
      block_number
    FROM transactions
    WHERE block_number <= ?
    ORDER BY block_number ASC, log_index ASC`,
    [blockNumber]
  );

  // Process transactions using BigInt arithmetic
  const balances = new Map<string, HistoricalBalanceInfo>();

  for (const tx of transactions) {
    if (tx.event_type === "ISSUED") {
      // ISSUED events: only increment to to_address (never to zero address)
      if (tx.to_address && tx.to_address.toLowerCase() !== ZERO_ADDRESS) {
        const address = tx.to_address.toLowerCase();
        const current = balances.get(address) || {
          balance: 0n,
          lastUpdatedBlock: 0,
        };
        balances.set(address, {
          balance: current.balance + BigInt(tx.amount),
          lastUpdatedBlock: Math.max(current.lastUpdatedBlock, tx.block_number),
        });
      }
    } else if (tx.event_type === "TRANSFER") {
      // TRANSFER events: decrement from from_address, increment to to_address
      if (
        tx.from_address &&
        tx.from_address.toLowerCase() !== ZERO_ADDRESS
      ) {
        const address = tx.from_address.toLowerCase();
        const current = balances.get(address) || {
          balance: 0n,
          lastUpdatedBlock: 0,
        };
        balances.set(address, {
          balance: current.balance - BigInt(tx.amount),
          lastUpdatedBlock: Math.max(current.lastUpdatedBlock, tx.block_number),
        });
      }
      if (tx.to_address && tx.to_address.toLowerCase() !== ZERO_ADDRESS) {
        const address = tx.to_address.toLowerCase();
        const current = balances.get(address) || {
          balance: 0n,
          lastUpdatedBlock: 0,
        };
        balances.set(address, {
          balance: current.balance + BigInt(tx.amount),
          lastUpdatedBlock: Math.max(current.lastUpdatedBlock, tx.block_number),
        });
      }
    }
  }

  // Remove zero balances
  for (const [address, info] of balances.entries()) {
    if (info.balance === 0n) {
      balances.delete(address);
    }
  }

  return balances;
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

    // Get block range info
    const firstBlock = getFirstIndexedBlock();
    const lastBlock = getLastIndexedBlock();

    // Parse and validate blockNumber if provided
    let blockNumber: number | null = null;
    let warning: string | null = null;
    const hasBlockNumberParam = request.query.blockNumber !== undefined;

    if (hasBlockNumberParam) {
      const parsedBlock = parseInt(request.query.blockNumber, 10);
      if (isNaN(parsedBlock) || parsedBlock < 0) {
        // Invalid format, clamp to valid range
        const clamped = clampBlockNumber(0);
        blockNumber = clamped.blockNumber;
        warning = clamped.warning || "Invalid block number format, using latest";
      } else {
        const clamped = clampBlockNumber(parsedBlock);
        blockNumber = clamped.blockNumber;
        warning = clamped.warning;
      }
    }

    const publicClient = getPublicClient();
    const { address: tokenAddress, abi } = CONTRACTS.token;

    let shareholders: Array<{
      address: string;
      balance: string;
      effectiveBalance: string;
      ownershipPercentage: number;
      lastUpdatedBlock: number;
    }>;
    let total: number;
    let supply: bigint;
    let splitFactor: bigint;
    let totalEffectiveSupply: bigint;

    if (blockNumber !== null) {
      // Historical snapshot mode: compute balances from transactions
      const historicalBalances = getHistoricalBalances(blockNumber);

      // Get splitFactor at the specified block
      const factorAtBlock = await safeRead<bigint>(publicClient, {
        address: tokenAddress,
        abi,
        functionName: "splitFactor",
        blockNumber: BigInt(blockNumber),
      });

      splitFactor = factorAtBlock || 1n * BigInt(10 ** 18); // Default to 1e18 if null

      // Calculate total supply at block
      const totalSupplyAtBlock = Array.from(historicalBalances.values()).reduce(
        (sum, info) => sum + info.balance,
        0n
      );

      supply = totalSupplyAtBlock;
      totalEffectiveSupply =
        (totalSupplyAtBlock * splitFactor) / BigInt(10 ** 18);

      // Convert Map to array and sort by effective balance
      const shareholdersArray = Array.from(historicalBalances.entries())
        .map(([address, info]) => {
          const effectiveBalance =
            (info.balance * splitFactor) / BigInt(10 ** 18);
          return {
            address,
            balance: info.balance.toString(),
            effectiveBalance: effectiveBalance.toString(),
            lastUpdatedBlock: info.lastUpdatedBlock, // Use actual last transaction block
          };
        })
        .sort((a, b) => {
          const aEff = BigInt(a.effectiveBalance);
          const bEff = BigInt(b.effectiveBalance);
          return aEff > bEff ? -1 : aEff < bEff ? 1 : 0;
        });

      total = shareholdersArray.length;

      // Apply pagination
      const paginatedShareholders = shareholdersArray.slice(
        offset,
        offset + limit
      );

      // Transform to response format
      shareholders = paginatedShareholders.map((row) =>
        asShareholderResponse(row, totalEffectiveSupply)
      );
    } else {
      // Current state mode: use existing logic
      // Get total count
      const totalResult = queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM shareholders"
      );
      total = totalResult?.count || 0;

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
      const { supply: cachedSupply, splitFactor: cachedFactor, totalEffectiveSupply: cachedTotalEff } =
        await getCachedSupply();
      supply = cachedSupply;
      splitFactor = cachedFactor;
      totalEffectiveSupply = cachedTotalEff;

      // Transform rows to response format
      shareholders = rows.map((row) =>
        asShareholderResponse(row, totalEffectiveSupply)
      );
    }

    // Get all transaction blocks for navigation
    const transactionBlocks = getAllTransactionBlocks();

    // Build response
    const response: {
      shareholders: typeof shareholders;
      pagination: {
        limit: number;
        offset: number;
        total: number;
      };
      totalSupply: string;
      totalEffectiveSupply: string;
      blockNumber?: number;
      latestBlock?: number;
      firstBlock?: number;
      nextBlock?: number | null;
      prevBlock?: number | null;
      transactionBlocks?: number[];
      warning?: string;
    } = {
      shareholders,
      pagination: {
        limit,
        offset,
        total,
      },
      totalSupply: supply.toString(),
      totalEffectiveSupply: totalEffectiveSupply.toString(),
      transactionBlocks, // Always include the list of transaction blocks
    };

    // Always include latestBlock and firstBlock for navigation (if available)
    if (lastBlock !== null) {
      response.latestBlock = lastBlock;
    }
    if (firstBlock !== null) {
      response.firstBlock = firstBlock;
    }

    // Add block metadata if blockNumber was provided in query (even if null after clamping)
    if (hasBlockNumberParam && blockNumber !== null) {
      response.blockNumber = blockNumber;
      
      // Find next and previous transaction blocks for smart navigation
      const nextBlock = getNextTransactionBlock(blockNumber);
      const prevBlock = getPreviousTransactionBlock(blockNumber);
      response.nextBlock = nextBlock;
      response.prevBlock = prevBlock;
      
      if (warning) {
        response.warning = warning;
      }
    } else if (lastBlock !== null) {
      // When viewing latest, provide previous transaction block for navigation
      const prevBlock = getPreviousTransactionBlock(lastBlock);
      response.prevBlock = prevBlock;
      // nextBlock is null when at latest
      response.nextBlock = null;
    }

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
          blockNumber: { type: ["integer", "null"] },
          latestBlock: { type: ["integer", "null"] },
          firstBlock: { type: ["integer", "null"] },
          nextBlock: { type: ["integer", "null"] },
          prevBlock: { type: ["integer", "null"] },
          transactionBlocks: { 
            type: "array",
            items: { type: "integer" }
          },
          warning: { type: ["string", "null"] },
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

  // Register specific routes before parameterized routes to avoid conflicts
  // Fastify matches routes in registration order, so /me must come before /:address
  fastify.get("/shareholders", { schema: shareholdersListSchema }, getShareholders);
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

