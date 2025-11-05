/**
 * @file Tests for authentication middleware with role-based access control
 * @notice Validates requireAuth, requireRole, and requireAnyRole middleware
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  requireAuth,
  requireRole,
  requireAnyRole,
  requireWalletSignature,
  setDatabase,
  setFirebaseAuth,
  type AuthContext,
} from "../../middleware/auth";
import { USERS_TABLE_SCHEMA } from "../../db/schema";
import { createUser } from "../../services/db/users";

// Mock Firebase Auth
const mockFirebaseAuth = {
  verifyIdToken: mock(async (token: string) => {
    if (token === "valid-token") {
      return {
        uid: "test-uid-123",
        email: "test@example.com",
      };
    }
    if (token === "valid-token-issuer") {
      return {
        uid: "test-uid-issuer",
        email: "issuer@example.com",
      };
    }
    if (token === "valid-token-admin") {
      return {
        uid: "test-uid-admin",
        email: "admin@example.com",
      };
    }
    throw new Error("Invalid token");
  }),
};

describe("Authentication Middleware", () => {
  let db: Database;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(":memory:");
    db.exec(USERS_TABLE_SCHEMA);

    // Set up database and Firebase auth in middleware
    setDatabase(db);
    setFirebaseAuth(mockFirebaseAuth);

    // Create test users
    createUser(db, {
      uid: "test-uid-123",
      email: "test@example.com",
      displayName: "Test User",
      role: "investor",
    });

    createUser(db, {
      uid: "test-uid-issuer",
      email: "issuer@example.com",
      displayName: "Issuer User",
      role: "issuer",
    });

    createUser(db, {
      uid: "test-uid-admin",
      email: "admin@example.com",
      displayName: "Admin User",
      role: "admin",
    });

    // Mock request and reply objects
    mockRequest = {
      headers: {},
      user: undefined,
      body: {},
    };

    mockReply = {
      code: mock((statusCode: number) => {
        return {
          send: mock((payload: any) => ({ statusCode, payload })),
        } as FastifyReply;
      }),
      send: mock((payload: any) => payload),
    };
  });

  describe("requireAuth", () => {
    it("successfully authenticates user and fetches role from database", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.uid).toBe("test-uid-123");
      expect(mockRequest.user?.email).toBe("test@example.com");
      expect(mockRequest.user?.role).toBe("investor");
    });

    it("fetches issuer role from database", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-issuer",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user?.role).toBe("issuer");
    });

    it("fetches admin role from database", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-admin",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user?.role).toBe("admin");
    });

    it("returns 401 when Authorization header is missing", async () => {
      mockRequest.headers = {};

      const result = await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
    });

    it("returns 401 when token is invalid", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
    });

    it("returns 403 when user not found in database", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };

      // Delete user from database
      db.exec("DELETE FROM users WHERE uid = 'test-uid-123'");

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });
  });

  describe("requireRole", () => {
    beforeEach(() => {
      // Set up authenticated user
      mockRequest.user = {
        uid: "test-uid-issuer",
        email: "issuer@example.com",
        role: "issuer",
      };
    });

    it("allows access when user has required role", async () => {
      const middleware = requireRole("issuer");
      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should not call reply.code with 403
      expect(mockReply.code).not.toHaveBeenCalledWith(403);
    });

    it("blocks access when user does not have required role", async () => {
      const middleware = requireRole("admin");
      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });

    it("returns 401 when user is not authenticated", async () => {
      mockRequest.user = undefined;
      const middleware = requireRole("issuer");

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
    });
  });

  describe("requireAnyRole", () => {
    beforeEach(() => {
      mockRequest.user = {
        uid: "test-uid-issuer",
        email: "issuer@example.com",
        role: "issuer",
      };
    });

    it("allows access when user has one of the required roles", async () => {
      const middleware = requireAnyRole(["admin", "issuer"]);
      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).not.toHaveBeenCalledWith(403);
    });

    it("allows access when user has admin role", async () => {
      mockRequest.user = {
        uid: "test-uid-admin",
        email: "admin@example.com",
        role: "admin",
      };

      const middleware = requireAnyRole(["admin", "issuer"]);
      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).not.toHaveBeenCalledWith(403);
    });

    it("blocks access when user does not have any required role", async () => {
      const middleware = requireAnyRole(["admin"]);
      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });

    it("returns 401 when user is not authenticated", async () => {
      mockRequest.user = undefined;
      const middleware = requireAnyRole(["admin", "issuer"]);

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
    });
  });

  describe("requireWalletSignature", () => {
    beforeEach(() => {
      mockRequest.user = {
        uid: "test-uid-123",
        email: "test@example.com",
        role: "investor",
        wallet_address: "0x1234567890123456789012345678901234567890",
      };
    });

    it("returns 400 when wallet is not linked", async () => {
      mockRequest.user = {
        ...mockRequest.user!,
        wallet_address: undefined,
      };

      await requireWalletSignature(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(400);
    });

    it("returns 400 when message or signature is missing", async () => {
      mockRequest.body = {};

      await requireWalletSignature(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(400);
    });
  });

  describe("Middleware Composition", () => {
    it("can chain requireAuth and requireRole", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-issuer",
      };

      // First authenticate
      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.role).toBe("issuer");

      // Then check role
      const roleMiddleware = requireRole("issuer");
      await roleMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should pass without errors
      expect(mockReply.code).not.toHaveBeenCalledWith(403);
    });

    it("can chain requireAuth and requireAnyRole", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-issuer",
      };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const roleMiddleware = requireAnyRole(["admin", "issuer"]);
      await roleMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).not.toHaveBeenCalledWith(403);
    });
  });
});
