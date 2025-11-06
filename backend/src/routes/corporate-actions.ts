/**
 * @file Corporate Actions API routes
 * @notice REST endpoints for querying corporate actions and historical cap table snapshots
 * 
 * Database table: corporate_actions
 * - Stores indexed CorporateActionRecorded events from the CapTable contract
 * - Includes action metadata: action_type, data, block_number, block_timestamp, log_index
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { query, queryOne } from "../db/index";
import { getPublicClient } from "../services/chain/client";
import { CONTRACTS } from "../config/contracts";
import { safeRead } from "../services/chain/utils";
import type { Address } from "viem";

/**
 * Build WHERE clause and parameters for corporate actions filtering
 */
function buildWhereClause(filters: {
  actionType?: string;
  fromDate?: number;
  toDate?: number;
}): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.actionType) {
    conditions.push("action_type = ?");
    params.push(filters.actionType);
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
 * GET /api/corporate-actions
 * Returns paginated corporate actions list with optional filtering
 */
async function getCorporateActions(
  request: FastifyRequest<{
    Querystring: {
      limit?: string;
      offset?: string;
      actionType?: string;
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
      actionType?: string;
      fromDate?: number;
      toDate?: number;
    } = {};

    if (request.query.actionType) {
      filters.actionType = request.query.actionType;
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
    const whereClause = buildWhereClause(filters);

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM corporate_actions ${whereClause.where}`;
    const totalResult = queryOne<{ count: number }>(
      countSql,
      whereClause.params
    );
    const total = totalResult?.count || 0;

    // Query corporate actions from database
    const sql = `
      SELECT 
        id,
        action_type AS actionType,
        data,
        block_number AS blockNumber,
        block_timestamp AS blockTimestamp,
        log_index AS logIndex
      FROM corporate_actions
      ${whereClause.where}
      ORDER BY block_number DESC, log_index ASC
      LIMIT ? OFFSET ?
    `;

    const rows = query<{
      id: number;
      actionType: string;
      data: string | null;
      blockNumber: number;
      blockTimestamp: number | null;
      logIndex: number;
    }>(sql, [...whereClause.params, limit, offset]);

    // Transform rows to response format
    const corporateActions = rows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      data: row.data,
      blockNumber: row.blockNumber,
      blockTimestamp: row.blockTimestamp,
      logIndex: row.logIndex,
    }));

    reply.send({
      corporateActions,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    request.log.error(error, "Error fetching corporate actions");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch corporate actions",
    });
  }
}

/**
 * GET /api/snapshots/:block
 * Returns historical cap table snapshot at a specific block number
 */
async function getSnapshot(
  request: FastifyRequest<{
    Params: {
      block: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { block } = request.params;

    // Validate block number
    const blockNumber = parseInt(block, 10);
    if (isNaN(blockNumber) || blockNumber < 0) {
      reply.code(400).send({
        error: "Invalid block number",
        message: "Block number must be a valid non-negative integer",
      });
      return;
    }

    // Query all shareholder addresses from database
    const shareholderRows = query<{ address: string }>(
      "SELECT address FROM shareholders"
    );

    if (shareholderRows.length === 0) {
      reply.send({
        blockNumber,
        shareholders: [],
      });
      return;
    }

    const publicClient = getPublicClient();
    const { address: tokenAddress, abi } = CONTRACTS.token;

    // Query balances at the specified block number using Promise.all
    const balancePromises = shareholderRows.map((row) =>
      safeRead<bigint>(publicClient, {
        address: tokenAddress,
        abi,
        functionName: "balanceOf",
        args: [row.address.toLowerCase() as Address],
        blockNumber: BigInt(blockNumber),
      })
    );

    const balances = await Promise.all(balancePromises);

    // Transform results to response format
    const shareholders = shareholderRows.map((row, index) => {
      const balance = balances[index] ? balances[index]!.toString() : "0";

      return {
        address: row.address.toLowerCase(),
        balance,
      };
    });

    reply.send({
      blockNumber,
      shareholders,
    });
  } catch (error) {
    request.log.error(error, "Error fetching snapshot");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch snapshot",
    });
  }
}

/**
 * Register corporate actions routes with Fastify instance
 */
export async function corporateActionsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Response schema for corporate action object
  const corporateActionSchema = {
    type: "object",
    properties: {
      id: { type: "integer" },
      actionType: { type: "string" },
      data: { type: ["string", "null"] },
      blockNumber: { type: "integer" },
      blockTimestamp: { type: ["integer", "null"] },
      logIndex: { type: "integer" },
    },
    required: ["id", "actionType", "blockNumber", "logIndex"],
  };

  // Response schema for GET /api/corporate-actions
  const corporateActionsListSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          corporateActions: {
            type: "array",
            items: corporateActionSchema,
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
        required: ["corporateActions", "pagination"],
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

  // Response schema for GET /api/snapshots/:block
  const snapshotSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          blockNumber: { type: "integer" },
          shareholders: {
            type: "array",
            items: {
              type: "object",
              properties: {
                address: { type: "string" },
                balance: { type: "string" },
              },
              required: ["address", "balance"],
            },
          },
        },
        required: ["blockNumber", "shareholders"],
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

  fastify.get(
    "/corporate-actions",
    { schema: corporateActionsListSchema },
    getCorporateActions
  );
  fastify.get("/snapshots/:block", { schema: snapshotSchema }, getSnapshot);
}

