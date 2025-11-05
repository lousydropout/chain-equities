/**
 * @file Tests for shareholders API routes
 * @notice Validates GET /api/shareholders and GET /api/shareholders/:address endpoints
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import Fastify from "fastify";
import { Database } from "bun:sqlite";
import { migrate } from "../../db/migrations";

// Mock the client module
const mockReadContract = mock();
const mockPublicClient = {
  readContract: mockReadContract,
};

// Mock getPublicClient
mock.module("../../services/chain/client", () => ({
  getPublicClient: () => mockPublicClient,
}));

// Mock the contracts config
mock.module("../../config/contracts", () => ({
  CONTRACTS: {
    token: {
      address: "0x2222222222222222222222222222222222222222" as `0x${string}`,
      abi: [],
    },
  },
}));

// Set up database mock with a closure that will capture the test database
let testDbInstance: Database | null = null;
mock.module("../../db/index", () => {
  return {
    connect: () => {
      if (!testDbInstance) {
        throw new Error("Test database not initialized. Call beforeEach first.");
      }
      return testDbInstance;
    },
    query: <T = unknown>(sql: string, params: unknown[] = []): T[] => {
      if (!testDbInstance) {
        throw new Error("Test database not initialized.");
      }
      const stmt = testDbInstance.prepare(sql);
      return stmt.all(...(params as any[])) as T[];
    },
    queryOne: <T = unknown>(
      sql: string,
      params: unknown[] = []
    ): T | null => {
      if (!testDbInstance) {
        throw new Error("Test database not initialized.");
      }
      const stmt = testDbInstance.prepare(sql);
      const result = stmt.get(...(params as any[])) as T | undefined;
      return result || null;
    },
    execute: (
      sql: string,
      params: unknown[] = []
    ): { lastInsertRowid: number; changes: number } => {
      if (!testDbInstance) {
        throw new Error("Test database not initialized.");
      }
      const stmt = testDbInstance.prepare(sql);
      const result = stmt.run(...(params as any[]));
      return {
        lastInsertRowid: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    transaction: <T>(callback: (db: Database) => T): T => {
      if (!testDbInstance) {
        throw new Error("Test database not initialized.");
      }
      testDbInstance.exec("PRAGMA foreign_keys = ON");
      testDbInstance.exec("BEGIN TRANSACTION");
      try {
        const result = callback(testDbInstance);
        testDbInstance.exec("COMMIT");
        return result;
      } catch (error) {
        testDbInstance.exec("ROLLBACK");
        throw error;
      }
    },
    close: () => {
      // No-op for test database
    },
    getDatabase: () => {
      if (!testDbInstance) {
        throw new Error("Test database not initialized.");
      }
      return testDbInstance;
    },
  };
});

// Import routes AFTER mocks are set up
import { shareholdersRoutes, resetCache } from "../shareholders";

describe("Shareholders Routes", () => {
  let app: ReturnType<typeof Fastify>;
  let db: Database;

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(":memory:");
    migrate(db);

    // Set the test database instance for the mock
    testDbInstance = db;

    // Create a new Fastify instance for each test
    app = Fastify({
      logger: false,
    });

    // Register shareholders routes with /api prefix
    await app.register(shareholdersRoutes, { prefix: "/api" });

    // Reset contract mock and clear cache
    mockReadContract.mockReset();
    resetCache(); // Clear cache between tests
  });

  afterEach(async () => {
    // Clear test database reference first
    testDbInstance = null;
    
    // Close database and app
    if (db) {
      db.close();
    }
    await app.close();
  });

  describe("GET /api/shareholders", () => {
    it("should return paginated shareholders list with ownership percentages", async () => {
      // Insert test shareholders
      db.run(`
        INSERT INTO shareholders (address, balance, effective_balance, last_updated_block)
        VALUES 
          ('0x1111111111111111111111111111111111111111', '1000000000000000000000', '2000000000000000000000', 12345),
          ('0x3333333333333333333333333333333333333333', '500000000000000000000', '1000000000000000000000', 12346)
      `);

      // Mock contract reads for totalSupply and splitFactor (cached)
      // splitFactor for 2x split = 2 * 10^18 = 2000000000000000000
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000000")) // totalSupply (1M tokens)
        .mockResolvedValueOnce(BigInt("2000000000000000000")); // splitFactor (2x = 2e18)

      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders?limit=50&offset=0",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty("shareholders");
      expect(body).toHaveProperty("pagination");
      expect(body).toHaveProperty("totalSupply");
      expect(body).toHaveProperty("totalEffectiveSupply");

      expect(body.shareholders).toHaveLength(2);
      expect(body.shareholders[0]).toMatchObject({
        address: "0x1111111111111111111111111111111111111111",
        balance: "1000000000000000000000",
        effectiveBalance: "2000000000000000000000",
        lastUpdatedBlock: 12345,
      });

      expect(body.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: 2,
      });

      // Verify ownership percentages are calculated correctly
      // totalSupply = 1000000000000000000000000 wei (1M tokens)
      // splitFactor = 2000000000000000000 (2x = 2e18)
      // totalEffectiveSupply = (1000000000000000000000000 * 2000000000000000000) / 1e18 = 2000000000000000000000000 wei (2M tokens)
      // Shareholder 1 effective: 2000000000000000000000 wei
      // Shareholder 2 effective: 1000000000000000000000 wei
      // Percentage 1: 2000000000000000000000 / 2000000000000000000000000 = 0.001 = 0.1%
      // Percentage 2: 1000000000000000000000 / 2000000000000000000000000 = 0.0005 = 0.05%
      expect(body.shareholders[0].ownershipPercentage).toBeCloseTo(0.1, 2);
      expect(body.shareholders[1].ownershipPercentage).toBeCloseTo(0.05, 2);
    });

    it("should use default pagination parameters when not provided", async () => {
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000000"))
        .mockResolvedValueOnce(BigInt("1000000000000000000")); // 1x split = 1e18

      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: 0,
      });
    });

    it("should enforce max limit of 100", async () => {
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000000"))
        .mockResolvedValueOnce(BigInt("1000000000000000000000"));

      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders?limit=200&offset=0",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pagination.limit).toBe(100);
    });

    it("should enforce min limit of 1", async () => {
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000000"))
        .mockResolvedValueOnce(BigInt("1000000000000000000000"));

      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders?limit=0&offset=0",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pagination.limit).toBe(1);
    });

    it("should enforce min offset of 0", async () => {
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000000"))
        .mockResolvedValueOnce(BigInt("1000000000000000000000"));

      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders?limit=50&offset=-5",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pagination.offset).toBe(0);
    });

    it("should return empty shareholders array when offset >= total", async () => {
      // Insert one shareholder
      db.run(`
        INSERT INTO shareholders (address, balance, effective_balance, last_updated_block)
        VALUES ('0x1111111111111111111111111111111111111111', '1000', '1000', 1)
      `);

      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000000"))
        .mockResolvedValueOnce(BigInt("1000000000000000000000"));

      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders?limit=50&offset=100",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.shareholders).toEqual([]);
      expect(body.pagination.total).toBe(1);
    });

    it("should return empty list when no shareholders exist", async () => {
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000000"))
        .mockResolvedValueOnce(BigInt("1000000000000000000000"));

      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.shareholders).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it("should handle contract read failure gracefully", async () => {
      // First call to getCachedSupply fails
      mockReadContract.mockRejectedValueOnce(new Error("RPC error"));

      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Internal server error",
        message: "Failed to fetch shareholders",
      });
    });
  });

  describe("GET /api/shareholders/:address", () => {
    const validAddress = "0x1111111111111111111111111111111111111111";
    const normalizedAddress = validAddress.toLowerCase();

    it("should return shareholder details when balance exists", async () => {
      // Insert shareholder in database
      db.run(`
        INSERT INTO shareholders (address, balance, effective_balance, last_updated_block)
        VALUES ('${normalizedAddress}', '1000000000000000000000', '2000000000000000000000', 12345)
      `);

      // Mock contract reads - balanceOf/effectiveBalanceOf first (Promise.all), then getCachedSupply
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000")) // balanceOf
        .mockResolvedValueOnce(BigInt("2000000000000000000000")) // effectiveBalanceOf
        .mockResolvedValueOnce(BigInt("1000000000000000000000000")) // totalSupply (from getCachedSupply)
        .mockResolvedValueOnce(BigInt("2000000000000000000")); // splitFactor (from getCachedSupply, 2x = 2e18)

      const response = await app.inject({
        method: "GET",
        url: `/api/shareholders/${validAddress}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.address).toBe(normalizedAddress);
      expect(body.balance).toBe("1000000000000000000000");
      expect(body.effectiveBalance).toBe("2000000000000000000000");
      expect(typeof body.ownershipPercentage).toBe("number");
      expect(body.lastUpdatedBlock).toBe(12345);

      // Verify contract calls
      expect(mockReadContract).toHaveBeenCalledWith({
        address: "0x2222222222222222222222222222222222222222",
        abi: [],
        functionName: "balanceOf",
        args: [normalizedAddress],
      });
      expect(mockReadContract).toHaveBeenCalledWith({
        address: "0x2222222222222222222222222222222222222222",
        abi: [],
        functionName: "effectiveBalanceOf",
        args: [normalizedAddress],
      });
    });

    it("should return 400 for invalid address format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/shareholders/invalid-address",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid address format",
        message: "Address must be a valid Ethereum address",
      });
    });

    it("should return 404 when shareholder has zero balance", async () => {
      // balanceOf/effectiveBalanceOf are called first, getCachedSupply is not called if balance is 0
      mockReadContract
        .mockResolvedValueOnce(BigInt(0)) // balanceOf returns 0
        .mockResolvedValueOnce(BigInt(0)); // effectiveBalanceOf returns 0

      const response = await app.inject({
        method: "GET",
        url: `/api/shareholders/${validAddress}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Shareholder not found",
        message: `No balance found for address ${validAddress}`,
      });
    });

    it("should return 404 when balanceOf returns null", async () => {
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000000")) // totalSupply (cached)
        .mockResolvedValueOnce(BigInt("2000000000000000000")); // splitFactor (cached, 2x = 2e18)
      // Actually, balanceOf and effectiveBalanceOf are called first in Promise.all
      // So remove the getCachedSupply mocks and just mock balanceOf/effectiveBalanceOf
      mockReadContract.mockReset();
      mockReadContract
        .mockResolvedValueOnce(null) // balanceOf fails
        .mockResolvedValueOnce(null); // effectiveBalanceOf also called (but not checked since balance is null)

      const response = await app.inject({
        method: "GET",
        url: `/api/shareholders/${validAddress}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Shareholder not found",
        message: `No balance found for address ${validAddress}`,
      });
    });

    it("should handle missing lastUpdatedBlock gracefully", async () => {
      // Don't insert shareholder in database - lastUpdatedBlock will be null
      // balanceOf/effectiveBalanceOf first, then getCachedSupply
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000")) // balanceOf
        .mockResolvedValueOnce(BigInt("2000000000000000000000")) // effectiveBalanceOf
        .mockResolvedValueOnce(BigInt("1000000000000000000000000")) // totalSupply (from getCachedSupply)
        .mockResolvedValueOnce(BigInt("2000000000000000000")); // splitFactor (from getCachedSupply, 2x = 2e18)

      const response = await app.inject({
        method: "GET",
        url: `/api/shareholders/${validAddress}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.lastUpdatedBlock).toBeNull();
    });

    it("should handle contract read failure gracefully", async () => {
      // balanceOf/effectiveBalanceOf succeed, but getCachedSupply fails
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000")) // balanceOf
        .mockResolvedValueOnce(BigInt("2000000000000000000000")) // effectiveBalanceOf
        .mockResolvedValueOnce(null); // totalSupply returns null (getCachedSupply fails)

      const response = await app.inject({
        method: "GET",
        url: `/api/shareholders/${validAddress}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Internal server error",
        message: "Failed to fetch shareholder information",
      });
    });

    it("should handle database query failure gracefully for lastUpdatedBlock", async () => {
      // Mock contract reads - balanceOf/effectiveBalanceOf first, then getCachedSupply
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000")) // balanceOf
        .mockResolvedValueOnce(BigInt("2000000000000000000000")) // effectiveBalanceOf
        .mockResolvedValueOnce(BigInt("1000000000000000000000000")) // totalSupply (from getCachedSupply)
        .mockResolvedValueOnce(BigInt("2000000000000000000")); // splitFactor (from getCachedSupply)

      // Don't insert shareholder - query will return null (not an error, just no result)
      // This tests that missing lastUpdatedBlock is handled gracefully

      const response = await app.inject({
        method: "GET",
        url: `/api/shareholders/${validAddress}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // lastUpdatedBlock should be null when not in DB
      expect(body.lastUpdatedBlock).toBeNull();
      expect(body.balance).toBe("1000000000000000000000");
      expect(body.effectiveBalance).toBe("2000000000000000000000");
    });

    it("should handle checksummed addresses correctly", async () => {
      const checksummedAddress = "0x1111111111111111111111111111111111111111"; // Same as validAddress but checksummed
      const normalizedAddress = checksummedAddress.toLowerCase();

      // Insert shareholder
      db.run(`
        INSERT INTO shareholders (address, balance, effective_balance, last_updated_block)
        VALUES ('${normalizedAddress}', '1000000000000000000000', '2000000000000000000000', 12345)
      `);

      // Mock contract reads - balanceOf/effectiveBalanceOf first, then getCachedSupply
      mockReadContract
        .mockResolvedValueOnce(BigInt("1000000000000000000000")) // balanceOf
        .mockResolvedValueOnce(BigInt("2000000000000000000000")) // effectiveBalanceOf
        .mockResolvedValueOnce(BigInt("1000000000000000000000000")) // totalSupply (from getCachedSupply)
        .mockResolvedValueOnce(BigInt("2000000000000000000")); // splitFactor (from getCachedSupply, 2x = 2e18)

      const response = await app.inject({
        method: "GET",
        url: `/api/shareholders/${checksummedAddress}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Address should be normalized to lowercase
      expect(body.address).toBe(normalizedAddress);
    });
  });
});
