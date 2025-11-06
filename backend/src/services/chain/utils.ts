/**
 * @file Utility functions for safe contract interactions
 * @notice Provides shared utilities for contract reads with consistent error handling
 */

import type { PublicClient, ReadContractParameters } from "viem";

/**
 * Safely read from a contract with graceful error handling
 * @param publicClient The viem public client instance
 * @param config Contract read configuration (address, abi, functionName, etc.)
 * @returns Promise that resolves to the read result or null if the read fails
 * @throws Never throws - always returns null on error
 */
export async function safeRead<T>(
  publicClient: PublicClient,
  config: ReadContractParameters
): Promise<T | null> {
  try {
    const result = await publicClient.readContract(config);
    return result as T;
  } catch (err) {
    // Log error for debugging but don't throw
    // Suppress logging in test environment to avoid noise from intentionally mocked errors
    if (process.env.NODE_ENV !== "test") {
      console.error("Contract read failed:", {
        address: config.address,
        functionName: config.functionName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }
}
