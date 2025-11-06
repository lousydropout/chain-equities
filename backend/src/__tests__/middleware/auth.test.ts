/**
 * @file Tests for mock authentication middleware (demo mode)
 * @notice Validates requireAuth returns demo user and deferred middlewares allow requests
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  requireAuth,
  requireRole,
  requireAnyRole,
  requireWalletSignature,
} from "../../middleware/auth";

describe("Mock Authentication Middleware (Demo Mode)", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let sendMock: ReturnType<typeof mock>;
  let codeMock: ReturnType<typeof mock>;

  beforeEach(() => {
    sendMock = mock((payload: any) => payload);
    codeMock = mock((statusCode: number) => {
      return {
        send: sendMock,
      } as unknown as FastifyReply;
    });

    // Mock request and reply objects
    mockRequest = {
      headers: {},
      user: undefined,
      body: {},
    };

    mockReply = {
      code: codeMock,
      send: sendMock,
    };
  });

  describe("requireAuth", () => {
    it("attaches demo user to request when Authorization header is present", async () => {
      mockRequest.headers = {
        authorization: "Bearer any-token",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.uid).toBe("demo-user");
      expect(mockRequest.user?.email).toBe("demo@example.com");
      expect(mockRequest.user?.role).toBe("issuer");
    });

    it("always returns demo user with issuer role regardless of token", async () => {
      mockRequest.headers = {
        authorization: "Bearer different-token",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user?.role).toBe("issuer");
      expect(codeMock).not.toHaveBeenCalled();
    });

    it("returns 401 when Authorization header is missing", async () => {
      mockRequest.headers = {};

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(codeMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: "Missing Authorization header",
        message: "Authorization header is required",
      });
      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe("requireRole (Demo Mode - Stubbed)", () => {
    it("allows all requests to pass through in demo mode", async () => {
      const middleware = requireRole("admin");
      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should not block requests in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });

    it("allows requests even without authenticated user in demo mode", async () => {
      mockRequest.user = undefined;
      const middleware = requireRole("issuer");

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should not block requests in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });
  });

  describe("requireAnyRole (Demo Mode - Stubbed)", () => {
    it("allows all requests to pass through in demo mode", async () => {
      const middleware = requireAnyRole(["admin"]);
      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should not block requests in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });

    it("allows requests even without authenticated user in demo mode", async () => {
      mockRequest.user = undefined;
      const middleware = requireAnyRole(["admin", "issuer"]);

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should not block requests in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });
  });

  describe("requireWalletSignature (Demo Mode - Stubbed)", () => {
    it("allows all requests to pass through without signature verification", async () => {
      mockRequest.user = {
        uid: "demo-user",
        email: "demo@example.com",
        role: "issuer",
      };
      mockRequest.body = {};

      await requireWalletSignature(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should not block requests in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });

    it("allows requests even without wallet address in demo mode", async () => {
      mockRequest.user = {
        uid: "demo-user",
        email: "demo@example.com",
        role: "issuer",
        wallet_address: undefined,
      };

      await requireWalletSignature(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should not block requests in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });
  });

  describe("Middleware Composition", () => {
    it("can chain requireAuth and requireRole in demo mode", async () => {
      mockRequest.headers = {
        authorization: "Bearer any-token",
      };

      // First authenticate
      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.uid).toBe("demo-user");
      expect(mockRequest.user?.role).toBe("issuer");

      // Then check role (should pass in demo mode)
      const roleMiddleware = requireRole("admin");
      await roleMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should pass without errors in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });

    it("can chain requireAuth and requireAnyRole in demo mode", async () => {
      mockRequest.headers = {
        authorization: "Bearer any-token",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const roleMiddleware = requireAnyRole(["admin"]);
      await roleMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should pass without errors in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });

    it("can chain requireAuth and requireWalletSignature in demo mode", async () => {
      mockRequest.headers = {
        authorization: "Bearer any-token",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      await requireWalletSignature(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should pass without errors in demo mode
      expect(codeMock).not.toHaveBeenCalled();
    });
  });
});
