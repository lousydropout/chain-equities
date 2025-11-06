/**
 * @file Tests for company information API routes
 * @notice Validates GET /api/company and GET /api/company/metadata endpoints
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import Fastify from "fastify";
import { companyRoutes } from "../company";

// Mock the database module (if needed)
const mockQuery = mock();
const mockQueryOne = mock();

// Mock the chain client module
const mockGetPublicClient = mock();
const mockSafeRead = mock();

mock.module("../../services/chain/client", () => ({
  getPublicClient: mockGetPublicClient,
}));

mock.module("../../services/chain/utils", () => ({
  safeRead: mockSafeRead,
}));

// Mock the contracts config
mock.module("../../config/contracts", () => ({
  CONTRACTS: {
    capTable: {
      address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      abi: [],
    },
  },
}));

describe("Company Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    // Create a new Fastify instance for each test
    app = Fastify({
      logger: false,
    });

    // Register company routes with /api prefix
    app.register(companyRoutes, { prefix: "/api" });

    // Create a mock public client object
    const mockPublicClient = {
      // Mock public client object
    };

    // Reset mocks between tests
    mockGetPublicClient.mockReturnValue(mockPublicClient);
    mockSafeRead.mockReset();
  });

  describe("GET /api/company", () => {
    it("should return full company details when contract read succeeds", async () => {
      const mockCompanyInfo: [string, string, `0x${string}`, `0x${string}`, bigint] = [
        "Acme Inc.",
        "ACME",
        "0x1111111111111111111111111111111111111111" as `0x${string}`,
        "0x2222222222222222222222222222222222222222" as `0x${string}`,
        BigInt(1725349933),
      ];

      mockSafeRead.mockResolvedValue(mockCompanyInfo);

      const response = await app.inject({
        method: "GET",
        url: "/api/company",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        name: "Acme Inc.",
        symbol: "ACME",
        issuer: "0x1111111111111111111111111111111111111111",
        token: "0x2222222222222222222222222222222222222222",
        capTableAddress: "0x1234567890123456789012345678901234567890",
        createdAt: 1725349933,
        isTokenLinked: true,
      });

      expect(mockSafeRead).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          address: "0x1234567890123456789012345678901234567890",
          abi: [],
          functionName: "getCompanyInfo",
        })
      );
    });

    it("should handle unlinked token gracefully (null token address)", async () => {
      const mockCompanyInfo: [string, string, `0x${string}`, `0x${string}`, bigint] = [
        "Acme Inc.",
        "ACME",
        "0x1111111111111111111111111111111111111111" as `0x${string}`,
        "0x0000000000000000000000000000000000000000" as `0x${string}`,
        BigInt(1725349933),
      ];

      mockSafeRead.mockResolvedValue(mockCompanyInfo);

      const response = await app.inject({
        method: "GET",
        url: "/api/company",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        name: "Acme Inc.",
        symbol: "ACME",
        issuer: "0x1111111111111111111111111111111111111111",
        token: null,
        capTableAddress: "0x1234567890123456789012345678901234567890",
        createdAt: 1725349933,
        isTokenLinked: false,
      });
    });

    it("should return 404 when contract read fails", async () => {
      mockSafeRead.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/company",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Company information not found",
        message: "Failed to read from CapTable contract",
      });
    });

    it("should return 404 when contract read throws an error (safeRead catches and returns null)", async () => {
      // safeRead catches errors internally and returns null, so we mock it to return null
      mockSafeRead.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/company",
      });

      // safeRead catches errors and returns null, so we get 404
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Company information not found",
        message: "Failed to read from CapTable contract",
      });
    });
  });

  describe("GET /api/company/metadata", () => {
    it("should return company metadata when all contract reads succeed", async () => {
      mockSafeRead
        .mockResolvedValueOnce("Acme Inc.") // name
        .mockResolvedValueOnce("ACME") // symbol
        .mockResolvedValueOnce("0x1111111111111111111111111111111111111111" as `0x${string}`) // owner
        .mockResolvedValueOnce("0x2222222222222222222222222222222222222222" as `0x${string}`) // token
        .mockResolvedValueOnce(BigInt(1725349933)) // createdAt
        .mockResolvedValueOnce(true); // isTokenLinked

      const response = await app.inject({
        method: "GET",
        url: "/api/company/metadata",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        name: "Acme Inc.",
        symbol: "ACME",
        issuer: "0x1111111111111111111111111111111111111111",
        createdAt: 1725349933,
        isTokenLinked: true,
        token: "0x2222222222222222222222222222222222222222",
      });

      expect(mockSafeRead).toHaveBeenCalledTimes(6);
    });

    it("should handle unlinked token gracefully in metadata endpoint", async () => {
      mockSafeRead
        .mockResolvedValueOnce("Acme Inc.") // name
        .mockResolvedValueOnce("ACME") // symbol
        .mockResolvedValueOnce("0x1111111111111111111111111111111111111111" as `0x${string}`) // owner
        .mockResolvedValueOnce("0x0000000000000000000000000000000000000000" as `0x${string}`) // token
        .mockResolvedValueOnce(BigInt(1725349933)) // createdAt
        .mockResolvedValueOnce(false); // isTokenLinked

      const response = await app.inject({
        method: "GET",
        url: "/api/company/metadata",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        name: "Acme Inc.",
        symbol: "ACME",
        issuer: "0x1111111111111111111111111111111111111111",
        createdAt: 1725349933,
        isTokenLinked: false,
        token: null,
      });
    });

    it("should return 404 when critical fields fail to read", async () => {
      mockSafeRead
        .mockResolvedValueOnce(null) // name fails
        .mockResolvedValueOnce("ACME") // symbol
        .mockResolvedValueOnce("0x1111111111111111111111111111111111111111" as `0x${string}`) // owner
        .mockResolvedValueOnce("0x2222222222222222222222222222222222222222" as `0x${string}`) // token
        .mockResolvedValueOnce(BigInt(1725349933)) // createdAt
        .mockResolvedValueOnce(true); // isTokenLinked

      const response = await app.inject({
        method: "GET",
        url: "/api/company/metadata",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Company metadata not found",
        message: "Failed to read from CapTable contract",
      });
    });

    it("should return 404 when contract read throws an error (safeRead catches and returns null)", async () => {
      // safeRead catches errors internally and returns null, so we mock it to return null
      mockSafeRead.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/company/metadata",
      });

      // safeRead catches errors and returns null, so we get 404
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Company metadata not found",
        message: "Failed to read from CapTable contract",
      });
    });

    it("should handle missing createdAt gracefully", async () => {
      mockSafeRead
        .mockResolvedValueOnce("Acme Inc.") // name
        .mockResolvedValueOnce("ACME") // symbol
        .mockResolvedValueOnce("0x1111111111111111111111111111111111111111" as `0x${string}`) // owner
        .mockResolvedValueOnce("0x2222222222222222222222222222222222222222" as `0x${string}`) // token
        .mockResolvedValueOnce(null) // createdAt fails
        .mockResolvedValueOnce(true); // isTokenLinked

      const response = await app.inject({
        method: "GET",
        url: "/api/company/metadata",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        error: "Company metadata not found",
        message: "Failed to read from CapTable contract",
      });
    });
  });
});

