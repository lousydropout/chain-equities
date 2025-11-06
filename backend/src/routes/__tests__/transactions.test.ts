/**
 * @file Tests for transaction API routes
 * @notice Validates GET /api/transactions and GET /api/transactions/:txHash endpoints
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import Fastify from "fastify";
import { transactionsRoutes } from "../transactions";

// Mock the database module
const mockQuery = mock();
const mockQueryOne = mock();

mock.module("../../db/index", () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
  asTransactionRecord: (row: unknown) => row,
}));

describe("Transaction Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    // Create a new Fastify instance for each test
    app = Fastify({
      logger: false,
    });

    // Register transaction routes with /api prefix
    app.register(transactionsRoutes, { prefix: "/api" });

    // Reset mocks between tests
    mockQuery.mockReset();
    mockQueryOne.mockReset();
  });

  describe("GET /api/transactions", () => {
    it("should return paginated transactions without filters", async () => {
      const mockTransactions = [
        {
          id: 1,
          txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
          fromAddress: "0x1111111111111111111111111111111111111111",
          toAddress: "0x2222222222222222222222222222222222222222",
          amount: "1000000000000000000",
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 0,
          eventType: "TRANSFER" as const,
        },
        {
          id: 2,
          txHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          fromAddress: null,
          toAddress: "0x3333333333333333333333333333333333333333",
          amount: "5000000000000000000",
          blockNumber: 99,
          blockTimestamp: 1725349930,
          logIndex: 0,
          eventType: "ISSUED" as const,
        },
      ];

      mockQueryOne.mockReturnValueOnce({ count: 2 });
      mockQuery.mockReturnValueOnce(mockTransactions);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        transactions: mockTransactions,
        pagination: {
          limit: 50,
          offset: 0,
          total: 2,
        },
      });

      expect(mockQueryOne).toHaveBeenCalledWith(
        "SELECT COUNT(*) as count FROM transactions ",
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
        url: "/api/transactions?limit=10&offset=20",
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
        url: "/api/transactions?limit=200",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pagination.limit).toBe(100);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        [100, 0]
      );
    });

    it("should filter by eventType", async () => {
      const mockTransactions = [
        {
          id: 1,
          txHash: "0x1234",
          fromAddress: null,
          toAddress: "0x2222",
          amount: "1000",
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 0,
          eventType: "ISSUED" as const,
        },
      ];

      mockQueryOne.mockReturnValueOnce({ count: 1 });
      mockQuery.mockReturnValueOnce(mockTransactions);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions?eventType=ISSUED",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.transactions).toHaveLength(1);
      expect(body.transactions[0].eventType).toBe("ISSUED");
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("event_type = ?"),
        ["ISSUED"]
      );
    });

    it("should return 400 for invalid eventType", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/transactions?eventType=INVALID",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid filter parameter",
        message: "Invalid eventType. Must be 'ISSUED' or 'TRANSFER'",
      });
    });

    it("should filter by address", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 5 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions?address=0x1111111111111111111111111111111111111111",
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("(from_address = ? OR to_address = ?)"),
        [
          "0x1111111111111111111111111111111111111111",
          "0x1111111111111111111111111111111111111111",
        ]
      );
    });

    it("should return 400 for invalid address format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/transactions?address=invalid",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid filter parameter",
        message: "Invalid address format",
      });
    });

    it("should filter by fromDate", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 3 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions?fromDate=1725349933",
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
        url: "/api/transactions?toDate=1725349933",
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
        url: "/api/transactions?fromDate=invalid",
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
        url: "/api/transactions?toDate=invalid",
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
        url: "/api/transactions?eventType=TRANSFER&address=0x1111111111111111111111111111111111111111&fromDate=1725349933&toDate=1725349999",
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("event_type = ?"),
        expect.arrayContaining(["TRANSFER"])
      );
    });

    it("should handle empty results", async () => {
      mockQueryOne.mockReturnValueOnce({ count: 0 });
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.transactions).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      mockQueryOne.mockImplementation(() => {
        throw new Error("Database error");
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Internal server error",
        message: "Failed to fetch transactions",
      });
    });
  });

  describe("GET /api/transactions/:txHash", () => {
    it("should return transaction details for valid hash", async () => {
      const mockTransactions = [
        {
          id: 1,
          txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
          fromAddress: "0x1111111111111111111111111111111111111111",
          toAddress: "0x2222222222222222222222222222222222222222",
          amount: "1000000000000000000",
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 0,
          eventType: "TRANSFER" as const,
        },
        {
          id: 2,
          txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
          fromAddress: "0x2222222222222222222222222222222222222222",
          toAddress: "0x3333333333333333333333333333333333333333",
          amount: "5000000000000000000",
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 1,
          eventType: "TRANSFER" as const,
        },
      ];

      mockQuery.mockReturnValueOnce(mockTransactions);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/0x1234567890123456789012345678901234567890123456789012345678901234",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        transactions: [
          {
            id: 1,
            fromAddress: "0x1111111111111111111111111111111111111111",
            toAddress: "0x2222222222222222222222222222222222222222",
            amount: "1000000000000000000",
            blockNumber: 100,
            blockTimestamp: 1725349933,
            logIndex: 0,
            eventType: "TRANSFER",
          },
          {
            id: 2,
            fromAddress: "0x2222222222222222222222222222222222222222",
            toAddress: "0x3333333333333333333333333333333333333333",
            amount: "5000000000000000000",
            blockNumber: 100,
            blockTimestamp: 1725349933,
            logIndex: 1,
            eventType: "TRANSFER",
          },
        ],
        blockNumber: 100,
        blockTimestamp: 1725349933,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE tx_hash = ?"),
        ["0x1234567890123456789012345678901234567890123456789012345678901234"]
      );
    });

    it("should return 404 for non-existent transaction hash", async () => {
      mockQuery.mockReturnValueOnce([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/0x1234567890123456789012345678901234567890123456789012345678901234",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Transaction not found",
        message:
          "No transactions found with hash 0x1234567890123456789012345678901234567890123456789012345678901234",
      });
    });

    it("should return 400 for invalid transaction hash format (too short)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/0x1234",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid transaction hash format",
        message: "Transaction hash must be a 66-character hex string starting with 0x",
      });
    });

    it("should return 400 for invalid transaction hash format (no 0x prefix)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/1234567890123456789012345678901234567890123456789012345678901234",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid transaction hash format",
        message: "Transaction hash must be a 66-character hex string starting with 0x",
      });
    });

    it("should return 400 for invalid transaction hash format (too long)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/0x12345678901234567890123456789012345678901234567890123456789012345",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Invalid transaction hash format",
        message: "Transaction hash must be a 66-character hex string starting with 0x",
      });
    });

    it("should return multiple events for same transaction hash", async () => {
      const mockTransactions = [
        {
          id: 1,
          txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
          fromAddress: null,
          toAddress: "0x1111",
          amount: "1000",
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 0,
          eventType: "ISSUED" as const,
        },
        {
          id: 2,
          txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
          fromAddress: "0x1111",
          toAddress: "0x2222",
          amount: "500",
          blockNumber: 100,
          blockTimestamp: 1725349933,
          logIndex: 1,
          eventType: "TRANSFER" as const,
        },
      ];

      mockQuery.mockReturnValueOnce(mockTransactions);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/0x1234567890123456789012345678901234567890123456789012345678901234",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.transactions).toHaveLength(2);
      expect(body.transactions[0].eventType).toBe("ISSUED");
      expect(body.transactions[1].eventType).toBe("TRANSFER");
    });

    it("should handle database errors gracefully", async () => {
      mockQuery.mockImplementation(() => {
        throw new Error("Database error");
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/0x1234567890123456789012345678901234567890123456789012345678901234",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Internal server error",
        message: "Failed to fetch transaction details",
      });
    });

    it("should handle null blockTimestamp", async () => {
      const mockTransactions = [
        {
          id: 1,
          txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
          fromAddress: "0x1111",
          toAddress: "0x2222",
          amount: "1000",
          blockNumber: 100,
          blockTimestamp: null,
          logIndex: 0,
          eventType: "TRANSFER" as const,
        },
      ];

      mockQuery.mockReturnValueOnce(mockTransactions);

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/0x1234567890123456789012345678901234567890123456789012345678901234",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.blockTimestamp).toBeNull();
      expect(body.transactions[0].blockTimestamp).toBeNull();
    });
  });
});

