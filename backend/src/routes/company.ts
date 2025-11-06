/**
 * @file Company information API routes
 * @notice REST endpoints for querying company metadata from the CapTable contract
 * 
 * Contract function mapping:
 * - name() view returns (string)
 * - symbol() view returns (string)
 * - owner() view returns (address) - returns issuer address
 * - token() view returns (address)
 * - createdAt() view returns (uint256)
 * - getCompanyInfo() view returns (string name, string symbol, address issuer, address token, uint256 createdAt)
 * - isTokenLinked() view returns (bool)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getPublicClient } from "../services/chain/client";
import { CONTRACTS } from "../config/contracts";
import { safeRead } from "../services/chain/utils";
import { queryOne } from "../db/index";

/**
 * Helper function to check if an address is zero address
 */
function isZeroAddress(address: string | null | undefined): boolean {
  if (!address) return true;
  return address === "0x0000000000000000000000000000000000000000" || address === "0x0";
}

/**
 * GET /api/company
 * Returns full company details including all metadata
 */
async function getCompany(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const publicClient = getPublicClient();
  const { address, abi } = CONTRACTS.capTable;

  try {
    // Query getCompanyInfo() for efficient single-call retrieval
    const result = await safeRead<
      [string, string, `0x${string}`, `0x${string}`, bigint]
    >(publicClient, {
      address,
      abi,
      functionName: "getCompanyInfo",
    });

    if (!result) {
      reply.code(404).send({
        error: "Company information not found",
        message: "Failed to read from CapTable contract",
      });
      return;
    }

    const [name, symbol, issuer, token, createdAt] = result;

    // Handle unlinked token gracefully
    const isTokenLinked = !isZeroAddress(token);
    const tokenAddress = isTokenLinked ? token : null;

    reply.send({
      name,
      symbol,
      issuer,
      token: tokenAddress,
      capTableAddress: address,
      createdAt: Number(createdAt),
      isTokenLinked,
    });
  } catch (error) {
    request.log.error(error, "Error fetching company information");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch company information",
    });
  }
}

/**
 * GET /api/company/metadata
 * Returns company metadata (name, symbol, issuer, creation timestamp, token link status)
 */
async function getCompanyMetadata(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const publicClient = getPublicClient();
  const { address, abi } = CONTRACTS.capTable;

  try {
    // Query individual fields for metadata endpoint
    const [name, symbol, owner, token, createdAt, isTokenLinked] =
      await Promise.all([
        safeRead<string>(publicClient, {
          address,
          abi,
          functionName: "name",
        }),
        safeRead<string>(publicClient, {
          address,
          abi,
          functionName: "symbol",
        }),
        safeRead<`0x${string}`>(publicClient, {
          address,
          abi,
          functionName: "owner",
        }),
        safeRead<`0x${string}`>(publicClient, {
          address,
          abi,
          functionName: "token",
        }),
        safeRead<bigint>(publicClient, {
          address,
          abi,
          functionName: "createdAt",
        }),
        safeRead<boolean>(publicClient, {
          address,
          abi,
          functionName: "isTokenLinked",
        }),
      ]);

    // Check if any critical fields failed
    if (!name || !symbol || !owner || createdAt === null) {
      reply.code(404).send({
        error: "Company metadata not found",
        message: "Failed to read from CapTable contract",
      });
      return;
    }

    // Handle unlinked token gracefully
    const tokenAddress = !isZeroAddress(token) ? token : null;
    const tokenLinked = isTokenLinked ?? false;

    reply.send({
      name,
      symbol,
      issuer: owner,
      createdAt: Number(createdAt),
      isTokenLinked: tokenLinked,
      token: tokenAddress,
    });
  } catch (error) {
    request.log.error(error, "Error fetching company metadata");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch company metadata",
    });
  }
}

/**
 * GET /api/company/stats
 * Returns comprehensive company statistics for dashboard display
 * Combines data from CapTable contract, Token contract, and shareholders database
 */
async function getCompanyStats(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const publicClient = getPublicClient();
  const { address: capTableAddress, abi: capTableAbi } = CONTRACTS.capTable;
  const { address: tokenAddress, abi: tokenAbi } = CONTRACTS.token;

  try {
    // Get company info from CapTable contract
    const companyInfo = await safeRead<
      [string, string, `0x${string}`, `0x${string}`, bigint]
    >(publicClient, {
      address: capTableAddress,
      abi: capTableAbi,
      functionName: "getCompanyInfo",
    });

    if (!companyInfo) {
      reply.code(404).send({
        error: "Company information not found",
        message: "Failed to read from CapTable contract",
      });
      return;
    }

    const [name, symbol, issuer, token, createdAt] = companyInfo;

    // Check if token is linked
    const isTokenLinked = !isZeroAddress(token);
    const linkedTokenAddress = isTokenLinked ? token : null;

    // Get token stats if linked
    let totalAuthorized = "0";
    let totalOutstanding = "0";
    let splitFactor: string | undefined;
    const decimals = 18; // Standard ERC20 decimals

    if (isTokenLinked && linkedTokenAddress) {
      const [authorized, supply, split] = await Promise.all([
        safeRead<bigint>(publicClient, {
          address: linkedTokenAddress,
          abi: tokenAbi,
          functionName: "totalAuthorized",
        }),
        safeRead<bigint>(publicClient, {
          address: linkedTokenAddress,
          abi: tokenAbi,
          functionName: "totalSupply",
        }),
        safeRead<bigint>(publicClient, {
          address: linkedTokenAddress,
          abi: tokenAbi,
          functionName: "splitFactor",
        }),
      ]);

      totalAuthorized = authorized?.toString() ?? "0";
      totalOutstanding = supply?.toString() ?? "0";
      splitFactor = split?.toString();
    }

    // Get total shareholders count from database
    const shareholderCount = queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM shareholders"
    );
    const totalShareholders = shareholderCount?.count ?? 0;

    // Format createdAt as ISO 8601 string
    const createdAtTimestamp = Number(createdAt);
    const createdAtDate = new Date(createdAtTimestamp * 1000);
    const createdAtISO = createdAtDate.toISOString();

    reply.send({
      name,
      symbol,
      issuer,
      createdAt: createdAtISO,
      tokenLinked: isTokenLinked,
      tokenAddress: linkedTokenAddress,
      totalShareholders,
      totalAuthorized,
      totalOutstanding,
      decimals,
      ...(splitFactor && { splitFactor }),
    });
  } catch (error) {
    request.log.error(error, "Error fetching company stats");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch company statistics",
    });
  }
}

/**
 * Register company routes with Fastify instance
 */
export async function companyRoutes(fastify: FastifyInstance): Promise<void> {
  // Response schema for GET /api/company
  const companySchema = {
    response: {
      200: {
        type: "object",
        properties: {
          name: { type: "string" },
          symbol: { type: "string" },
          issuer: { type: "string" },
          token: { type: ["string", "null"] },
          capTableAddress: { type: "string" },
          createdAt: { type: "number" },
          isTokenLinked: { type: "boolean" },
        },
        required: ["name", "symbol", "issuer", "capTableAddress", "createdAt", "isTokenLinked"],
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

  // Response schema for GET /api/company/metadata
  const metadataSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          name: { type: "string" },
          symbol: { type: "string" },
          issuer: { type: "string" },
          createdAt: { type: "number" },
          isTokenLinked: { type: "boolean" },
          token: { type: ["string", "null"] },
        },
        required: ["name", "symbol", "issuer", "createdAt", "isTokenLinked"],
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

  // Response schema for GET /api/company/stats
  const statsSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          name: { type: "string" },
          symbol: { type: "string" },
          issuer: { type: "string" },
          createdAt: { type: "string" },
          tokenLinked: { type: "boolean" },
          tokenAddress: { type: ["string", "null"] },
          totalShareholders: { type: "integer" },
          totalAuthorized: { type: "string" },
          totalOutstanding: { type: "string" },
          decimals: { type: "integer" },
          splitFactor: { type: "string" }, // Optional property (not in required array)
        },
        required: [
          "name",
          "symbol",
          "issuer",
          "createdAt",
          "tokenLinked",
          "tokenAddress",
          "totalShareholders",
          "totalAuthorized",
          "totalOutstanding",
          "decimals",
        ],
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

  fastify.get("/company", { schema: companySchema }, getCompany);
  fastify.get("/company/metadata", { schema: metadataSchema }, getCompanyMetadata);
  fastify.get("/company/stats", { schema: statsSchema }, getCompanyStats);
}

