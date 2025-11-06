/**
 * @file Transaction API routes
 * @notice REST endpoints for querying transaction history from indexed events
 * 
 * Database table: transactions
 * - Stores indexed Transfer and Issued events from the token contract
 * - Includes transaction metadata: tx_hash, from_address, to_address, amount, block_number, block_timestamp, log_index, event_type
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { query, queryOne, asTransactionRecord } from "../db/index";
import { isAddress } from "viem";

/**
 * Build WHERE clause and parameters for transaction filtering
 */
function buildWhereClause(filters: {
  eventType?: string;
  address?: string;
  fromDate?: number;
  toDate?: number;
}): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.eventType) {
    if (filters.eventType !== "ISSUED" && filters.eventType !== "TRANSFER") {
      throw new Error("Invalid eventType. Must be 'ISSUED' or 'TRANSFER'");
    }
    conditions.push("event_type = ?");
    params.push(filters.eventType);
  }

  if (filters.address) {
    if (!isAddress(filters.address)) {
      throw new Error("Invalid address format");
    }
    const normalizedAddress = filters.address.toLowerCase();
    conditions.push("(from_address = ? OR to_address = ?)");
    params.push(normalizedAddress, normalizedAddress);
  }

  if (filters.fromDate !== undefined) {
    conditions.push("block_timestamp >= ?");
    params.push(filters.fromDate);
  }

  if (filters.toDate !== undefined) {
    conditions.push("block_timestamp <= ?");
    params.push(filters.toDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return { where, params };
}

/**
 * GET /api/transactions
 * Returns paginated transaction history with optional filtering
 */
async function getTransactions(
  request: FastifyRequest<{
    Querystring: {
      limit?: string;
      offset?: string;
      eventType?: "ISSUED" | "TRANSFER";
      address?: string;
      fromDate?: string;
      toDate?: string;
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

    // Parse and validate filters
    const filters: {
      eventType?: string;
      address?: string;
      fromDate?: number;
      toDate?: number;
    } = {};

    if (request.query.eventType) {
      filters.eventType = request.query.eventType;
    }

    if (request.query.address) {
      filters.address = request.query.address;
    }

    if (request.query.fromDate) {
      const fromDate = parseInt(request.query.fromDate, 10);
      if (isNaN(fromDate) || fromDate < 0) {
        reply.code(400).send({
          error: "Invalid fromDate parameter",
          message: "fromDate must be a valid Unix timestamp (number)",
        });
        return;
      }
      filters.fromDate = fromDate;
    }

    if (request.query.toDate) {
      const toDate = parseInt(request.query.toDate, 10);
      if (isNaN(toDate) || toDate < 0) {
        reply.code(400).send({
          error: "Invalid toDate parameter",
          message: "toDate must be a valid Unix timestamp (number)",
        });
        return;
      }
      filters.toDate = toDate;
    }

    // Build WHERE clause
    let whereClause: { where: string; params: unknown[] };
    try {
      whereClause = buildWhereClause(filters);
    } catch (error) {
      reply.code(400).send({
        error: "Invalid filter parameter",
        message: error instanceof Error ? error.message : "Invalid filter",
      });
      return;
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM transactions ${whereClause.where}`;
    const totalResult = queryOne<{ count: number }>(
      countSql,
      whereClause.params
    );
    const total = totalResult?.count || 0;

    // Query transactions from database
    const sql = `
      SELECT 
        id,
        tx_hash AS txHash,
        from_address AS fromAddress,
        to_address AS toAddress,
        amount,
        block_number AS blockNumber,
        block_timestamp AS blockTimestamp,
        log_index AS logIndex,
        event_type AS eventType
      FROM transactions
      ${whereClause.where}
      ORDER BY block_number DESC, log_index ASC
      LIMIT ? OFFSET ?
    `;

    // Query result may have blockTimestamp as string or number (SQLite type coercion)
    const rows = query<{
      id: number;
      txHash: string;
      fromAddress: string | null;
      toAddress: string | null;
      amount: string;
      blockNumber: number;
      blockTimestamp: number | string | null;
      logIndex: number;
      eventType: "ISSUED" | "TRANSFER";
    }>(sql, [...whereClause.params, limit, offset]);

    // Transform rows to response format
    const transactions = rows.map((row) => {
      // Ensure blockTimestamp is a number or null (SQLite may return as string)
      let blockTimestamp: number | null = null;
      if (row.blockTimestamp !== null && row.blockTimestamp !== undefined) {
        const ts = Number(row.blockTimestamp);
        blockTimestamp = isNaN(ts) ? null : ts;
      }
      
      return {
        id: row.id,
        txHash: row.txHash,
        fromAddress: row.fromAddress,
        toAddress: row.toAddress,
        amount: row.amount,
        blockNumber: row.blockNumber,
        blockTimestamp,
        logIndex: row.logIndex,
        eventType: row.eventType,
      };
    });

    reply.send({
      transactions,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    request.log.error(error, "Error fetching transactions");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch transactions",
    });
  }
}

/**
 * GET /api/transactions/:txHash
 * Returns transaction details for a specific transaction hash
 */
async function getTransactionByHash(
  request: FastifyRequest<{
    Params: {
      txHash: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { txHash } = request.params;

    // Validate txHash format (should be hex string starting with 0x)
    if (!txHash.startsWith("0x") || txHash.length !== 66) {
      reply.code(400).send({
        error: "Invalid transaction hash format",
        message: "Transaction hash must be a 66-character hex string starting with 0x",
      });
      return;
    }

    // Query all transactions with matching hash
    // Query result may have blockTimestamp as string or number (SQLite type coercion)
    const rows = query<{
      id: number;
      txHash: string;
      fromAddress: string | null;
      toAddress: string | null;
      amount: string;
      blockNumber: number;
      blockTimestamp: number | string | null;
      logIndex: number;
      eventType: "ISSUED" | "TRANSFER";
    }>(
      `
      SELECT 
        id,
        tx_hash AS txHash,
        from_address AS fromAddress,
        to_address AS toAddress,
        amount,
        block_number AS blockNumber,
        block_timestamp AS blockTimestamp,
        log_index AS logIndex,
        event_type AS eventType
      FROM transactions
      WHERE tx_hash = ?
      ORDER BY log_index ASC
    `,
      [txHash]
    );

    if (rows.length === 0) {
      reply.code(404).send({
        error: "Transaction not found",
        message: `No transactions found with hash ${txHash}`,
      });
      return;
    }

    // All events in the same transaction have the same block_number and block_timestamp
    const firstRow = rows[0];
    const blockNumber = firstRow.blockNumber;
    
    // Ensure blockTimestamp is a number or null (SQLite may return as string)
    let blockTimestamp: number | null = null;
    if (firstRow.blockTimestamp !== null && firstRow.blockTimestamp !== undefined) {
      const ts = Number(firstRow.blockTimestamp);
      blockTimestamp = isNaN(ts) ? null : ts;
    }

    // Transform rows to response format
    const transactions = rows.map((row) => {
      // Ensure blockTimestamp is a number or null (SQLite may return as string)
      let ts: number | null = null;
      if (row.blockTimestamp !== null && row.blockTimestamp !== undefined) {
        const num = Number(row.blockTimestamp);
        ts = isNaN(num) ? null : num;
      }
      
      return {
        id: row.id,
        fromAddress: row.fromAddress,
        toAddress: row.toAddress,
        amount: row.amount,
        blockNumber: row.blockNumber,
        blockTimestamp: ts,
        logIndex: row.logIndex,
        eventType: row.eventType,
      };
    });

    reply.send({
      txHash,
      transactions,
      blockNumber,
      blockTimestamp,
    });
  } catch (error) {
    request.log.error(error, "Error fetching transaction by hash");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch transaction details",
    });
  }
}

/**
 * Register transaction routes with Fastify instance
 */
export async function transactionsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Response schema for transaction object
  const transactionSchema = {
    type: "object",
    properties: {
      id: { type: "integer" },
      txHash: { type: "string" },
      fromAddress: { type: ["string", "null"] },
      toAddress: { type: ["string", "null"] },
      amount: { type: "string" },
      blockNumber: { type: "integer" },
      blockTimestamp: { type: ["integer", "null"] },
      logIndex: { type: "integer" },
      eventType: { type: "string", enum: ["ISSUED", "TRANSFER"] },
    },
    required: [
      "id",
      "txHash",
      "fromAddress",
      "toAddress",
      "amount",
      "blockNumber",
      "logIndex",
      "eventType",
    ],
  };

  // Response schema for GET /api/transactions
  const transactionsListSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          transactions: {
            type: "array",
            items: transactionSchema,
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
        },
        required: ["transactions", "pagination"],
      },
      400: {
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

  // Response schema for transaction detail (without txHash in nested object)
  const transactionDetailSchema = {
    type: "object",
    properties: {
      id: { type: "integer" },
      fromAddress: { type: ["string", "null"] },
      toAddress: { type: ["string", "null"] },
      amount: { type: "string" },
      blockNumber: { type: "integer" },
      blockTimestamp: { type: ["integer", "null"] },
      logIndex: { type: "integer" },
      eventType: { type: "string", enum: ["ISSUED", "TRANSFER"] },
    },
    required: [
      "id",
      "fromAddress",
      "toAddress",
      "amount",
      "blockNumber",
      "logIndex",
      "eventType",
    ],
  };

  // Response schema for GET /api/transactions/:txHash
  const transactionDetailResponseSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          txHash: { type: "string" },
          transactions: {
            type: "array",
            items: transactionDetailSchema,
          },
          blockNumber: { type: "integer" },
          blockTimestamp: { type: ["integer", "null"] },
        },
        required: ["txHash", "transactions", "blockNumber"],
      },
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

  fastify.get("/transactions", { schema: transactionsListSchema }, getTransactions);
  fastify.get(
    "/transactions/:txHash",
    { schema: transactionDetailResponseSchema },
    getTransactionByHash
  );
}

