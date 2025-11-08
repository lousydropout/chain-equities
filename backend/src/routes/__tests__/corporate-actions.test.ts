/**
 * @file Tests for corporate actions API routes
 * @notice Validates GET /api/corporate-actions and GET /api/snapshots/:block endpoints
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import Fastify from "fastify";
import { corporateActionsRoutes } from "../corporate-actions";

// Mock the database module
const mockQuery = mock();
const mockQueryOne = mock();

mock.module("../../db/index", () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
}));

// Mock the chain client module
const mockGetPublicClient = mock();
const mockSafeRead = mock();
const mockPublicClient = {
  // Mock public client object
};

mock.module("../../services/chain/client", () => ({
  getPublicClient: mockGetPublicClient,
}));

mock.module("../../services/chain/utils", () => ({
  safeRead: mockSafeRead,
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

describe("Corporate Actions Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    // Create a new Fastify instance for each test
    app = Fastify({
      logger: false,
    });

    // Register corporate actions routes with /api prefix
    app.register(corporateActionsRoutes, { prefix: "/api" });

    // Reset mocks between tests
    mockQuery.mockReset();
    mockQueryOne.mockReset();
    mockGetPublicClient.mockReset();
    mockSafeRead.mockReset();
    // Default mock for getPublicClient to return a mock client
    mockGetPublicClient.mockReturnValue(mockPublicClient);
  });

  describe("GET /api/corporate-actions", () => {
    it("should return paginated corporate actions without filters", async () => {
      const mockActions = [
        {
          id: 1,
          actionType: "SPLIT",
          data: "0x1234",
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 0,
        },
        {
          id: 2,
          actionType: "SYMBOL_CHANGE",
          data: "0x5678",
          blockNumber: 99,
          blockTimestamp: 1725349930,
          logIndex: 0,
        },
      ];

      mockQueryOne.mockReturnValueOnce({ count: 2 });
      mockQuery.mockReturnValueOnce(mockActions);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        corporateActions: mockActions,
        pagination: {
          limit: 50,
          offset: 0,
          total: 2,
        },
      });

      expect(mockQueryOne).toHaveBeenCalledWith(
        "SELECT COUNT(*) as count FROM corporate_actions ",
        []
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        [50, 0]
      );
    });

    it("should respect pagination parameters", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 100 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions?limit=10&offset=20",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pagination).toEqual({
        limit: 10,
        offset: 20,
        total: 100,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        [10, 20]
      );
    });

    it("should enforce maximum limit of 100", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 200 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions?limit=200",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pagination.limit).toBe(100);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        [100, 0]
      );
    });

    it("should filter by actionType", async () => {
      const mockActions = [
        {
          id: 1,
          actionType: "SPLIT",
          data: "0x1234",
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 0,
        },
      ];

      mockQueryOne.mockReturnValueOnce({ count: 1 });
      mockQuery.mockReturnValueOnce(mockActions);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions?actionType=SPLIT",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.corporateActions).toHaveLength(1);
      expect(body.corporateActions[0].actionType).toBe("SPLIT");
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("action_type = ?"),
        ["SPLIT"]
      );
    });

    it("should filter by fromDate", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 3 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions?fromDate=1725349933",
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("block_timestamp >= ?"),
        [1725349933]
      );
    });

    it("should filter by toDate", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 3 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions?toDate=1725349933",
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("block_timestamp <= ?"),
        [1725349933]
      );
    });

    it("should return 400 for invalid fromDate", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions?fromDate=invalid",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid fromDate parameter",
        message: "fromDate must be a valid Unix timestamp (number)",
      });
    });

    it("should return 400 for invalid toDate", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions?toDate=invalid",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid toDate parameter",
        message: "toDate must be a valid Unix timestamp (number)",
      });
    });

    it("should combine multiple filters", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 2 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions?actionType=SPLIT&fromDate=1725349933&toDate=1725349999",
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("action_type = ?"),
        expect.arrayContaining(["SPLIT"])
      );
    });

    it("should handle empty results", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 0 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.corporateActions).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it("should handle null data field", async () => {
      const mockActions = [
        {
          id: 1,
          actionType: "SPLIT",
          data: null,
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 0,
        },
      ];

      mockQueryOne.mockReturnValueOnce({ count: 1 });
      mockQuery.mockReturnValueOnce(mockActions);

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.corporateActions[0].data).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      mockQueryOne.mockImplementation(() => {
        throw new Error("Database error");
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/corporate-actions",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Internal server error",
        message: "Failed to fetch corporate actions",
      });
    });
  });

  describe("GET /api/snapshots/:block", () => {
    it("should return snapshot for valid block number", async () => {
      const mockShareholders = [
        { address: "0x1111111111111111111111111111111111111111" },
        { address: "0x2222222222222222222222222222222222222222" },
      ];

      mockQuery.mockReturnValueOnce(mockShareholders);
      mockSafeRead
        .mockResolvedValueOnce(BigInt("1000000000000000000"))
        .mockResolvedValueOnce(BigInt("2000000000000000000"));

      const response = await app.inject({
        method: "GET",
        url: "/api/snapshots/100",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        blockNumber: 100,
        shareholders: [
          {
            address: "0x1111111111111111111111111111111111111111",
            balance: "1000000000000000000",
          },
          {
            address: "0x2222222222222222222222222222222222222222",
            balance: "2000000000000000000",
          },
        ],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT address FROM shareholders"
      );
      expect(mockSafeRead).toHaveBeenCalledTimes(2);
    });

    it("should return empty snapshot when no shareholders exist", async () => {
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/snapshots/100",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        blockNumber: 100,
        shareholders: [],
      });
    });

    it("should return 400 for invalid block number (non-numeric)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/snapshots/invalid",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid block number",
        message: "Block number must be a valid non-negative integer",
      });
    });

    it("should return 400 for negative block number", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/snapshots/-1",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid block number",
        message: "Block number must be a valid non-negative integer",
      });
    });

    it("should handle contract read failures gracefully", async () => {
      const mockShareholders = [
        { address: "0x1111111111111111111111111111111111111111" },
      ];

      mockQuery.mockReturnValueOnce(mockShareholders);
      mockSafeRead.mockResolvedValueOnce(null); // safeRead returns null on failure

      const response = await app.inject({
        method: "GET",
        url: "/api/snapshots/100",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.shareholders[0].balance).toBe("0");
    });

    it("should handle database errors gracefully", async () => {
      mockQuery.mockImplementation(() => {
        throw new Error("Database error");
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/snapshots/100",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Internal server error",
        message: "Failed to fetch snapshot",
      });
    });
  });
});

