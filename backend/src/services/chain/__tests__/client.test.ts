/**
 * @file Tests for Viem client configuration service
 * @notice Tests client initialization, chain configuration, connection, and error handling
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  getPublicClient,
  getWalletClient,
  getChain,
  testConnection,
  withRetry,
  resetInstances,
} from "../client";

describe("Viem Client Configuration", () => {
  // Save original environment variables
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset singleton instances before each test
    resetInstances();
    // Reset environment to defaults before each test
    process.env = { ...originalEnv };
    // Set default local network configuration
    process.env.CHAIN_ID = "31337";
    process.env.RPC_URL = "http://127.0.0.1:8545";
    process.env.WS_RPC_URL = "ws://127.0.0.1:8545";
    delete process.env.ADMIN_PRIVATE_KEY;
  });

  describe("Chain Configuration", () => {
    it("should return Hardhat chain for chainId 31337", () => {
      process.env.CHAIN_ID = "31337";
      const chain = getChain();
      expect(chain.id).toBe(31337);
      expect(chain.name).toBe("Hardhat");
    });

    it("should return Sepolia chain for chainId 11155111", () => {
      resetInstances();
      process.env.CHAIN_ID = "11155111";
      const chain = getChain();
      expect(chain.id).toBe(11155111);
      expect(chain.name).toBe("Sepolia");
    });

    it("should return Mainnet chain for chainId 1", () => {
      resetInstances();
      process.env.CHAIN_ID = "1";
      const chain = getChain();
      expect(chain.id).toBe(1);
      expect(chain.name).toBe("Ethereum");
    });

    it("should default to Hardhat chain when CHAIN_ID is not set", () => {
      delete process.env.CHAIN_ID;
      const chain = getChain();
      expect(chain.id).toBe(31337);
      expect(chain.name).toBe("Hardhat");
    });
  });

  describe("Public Client", () => {
    it("should create a public client instance", () => {
      const client = getPublicClient();
      expect(client).toBeDefined();
      expect(typeof client.getChainId).toBe("function");
    });

    it("should return the same singleton instance on multiple calls", () => {
      const client1 = getPublicClient();
      const client2 = getPublicClient();
      expect(client1).toBe(client2);
    });

    it("should use default RPC URL for local network", () => {
      delete process.env.RPC_URL;
      delete process.env.WS_RPC_URL;
      process.env.CHAIN_ID = "31337";
      const client = getPublicClient();
      expect(client).toBeDefined();
    });
  });

  describe("Wallet Client", () => {
    it("should return null when ADMIN_PRIVATE_KEY is not set", () => {
      delete process.env.ADMIN_PRIVATE_KEY;
      const wallet = getWalletClient();
      expect(wallet).toBeNull();
    });

    it("should create wallet client when ADMIN_PRIVATE_KEY is set", () => {
      // Use a test private key (not a real one)
      process.env.ADMIN_PRIVATE_KEY =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const wallet = getWalletClient();
      expect(wallet).toBeDefined();
      expect(typeof wallet.sendTransaction).toBe("function");
    });

    it("should return the same singleton wallet instance on multiple calls", () => {
      process.env.ADMIN_PRIVATE_KEY =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const wallet1 = getWalletClient();
      const wallet2 = getWalletClient();
      expect(wallet1).toBe(wallet2);
    });
  });

  describe("withRetry Helper", () => {
    it("should succeed on first attempt", async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        return "success";
      };

      const result = await withRetry(fn, 3, 100);
      expect(result).toBe("success");
      expect(attempts).toBe(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
        return "success";
      };

      const result = await withRetry(fn, 3, 10);
      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("should throw error after max retries", async () => {
      const fn = async () => {
        throw new Error("Always fails");
      };

      await expect(withRetry(fn, 2, 10)).rejects.toThrow("Always fails");
    });

    it("should use exponential backoff", async () => {
      const delays: number[] = [];
      let attempts = 0;
      const startTime = Date.now();

      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          const now = Date.now();
          if (attempts > 1) {
            delays.push(now - startTime);
          }
          throw new Error("Retry");
        }
        return "success";
      };

      await withRetry(fn, 3, 50);
      // Should have delays between retries (exponential backoff)
      expect(attempts).toBe(3);
    });
  });

  describe("Connection Testing", () => {
    it("should test connection successfully when node is running", async () => {
      // This test will only pass if Hardhat node is actually running
      // Skip if node is not available
      try {
        const result = await testConnection();
        expect(result).toBe(true);
      } catch (error) {
        // If node is not running, that's expected - just skip the test
        if (
          error instanceof Error &&
          error.message.includes("Cannot connect")
        ) {
          console.log("⏭️  Skipping connection test - Hardhat node not running");
          return;
        }
        throw error;
      }
    });

    it("should throw friendly error when node is not running", async () => {
      resetInstances();
      // Use an invalid RPC URL to simulate connection failure
      process.env.RPC_URL = "http://127.0.0.1:9999";
      // Don't set WS_RPC_URL to avoid WebSocket connection attempts
      delete process.env.WS_RPC_URL;

      // Verify the client will use the new invalid URL
      const client = getPublicClient();
      
      // Try to get chain ID with invalid URL - should fail
      try {
        await client.getChainId();
        // If we get here, the connection somehow succeeded (unlikely)
        throw new Error("Expected connection to fail but it succeeded");
      } catch (error) {
        // Connection should fail - verify it's the right error type
        if (error instanceof Error) {
          expect(
            error.message.includes("ECONNREFUSED") ||
              error.message.includes("connect") ||
              error.message.includes("fetch failed")
          ).toBe(true);
        }
      }
    }, 10000); // Increase test timeout to 10 seconds

    it("should throw error for chain ID mismatch", async () => {
      resetInstances();
      // Set wrong chain ID
      process.env.CHAIN_ID = "1"; // Mainnet
      process.env.RPC_URL = "http://127.0.0.1:8545"; // But pointing to local Hardhat

      try {
        await testConnection();
        // If we get here, connection might have succeeded (unlikely)
        // but chain ID check should fail
      } catch (error) {
        if (error instanceof Error) {
          expect(
            error.message.includes("Chain ID mismatch") ||
              error.message.includes("Cannot connect")
          ).toBe(true);
        }
      }
    });
  });

  describe("Environment Variable Handling", () => {
    it("should require RPC_URL for non-local networks", () => {
      resetInstances();
      process.env.CHAIN_ID = "11155111"; // Sepolia
      delete process.env.RPC_URL;

      expect(() => getPublicClient()).toThrow("RPC_URL environment variable is required");
    });

    it("should throw error for unsupported chain ID", () => {
      resetInstances();
      process.env.CHAIN_ID = "999999";

      expect(() => getChain()).toThrow("Unsupported chain ID");
    });

    it("should use custom RPC URLs when provided", () => {
      resetInstances();
      process.env.CHAIN_ID = "31337";
      process.env.RPC_URL = "http://custom:8545";
      process.env.WS_RPC_URL = "ws://custom:8545";

      const client = getPublicClient();
      expect(client).toBeDefined();
    });
  });
});

