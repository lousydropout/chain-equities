/**
 * @file Viem client configuration service
 * @notice Provides singleton public and wallet clients for blockchain interaction
 * @notice Supports Hardhat Node (local), Sepolia, and Mainnet with WebSocket/HTTP fallback
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { hardhat, sepolia, mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Chain registry mapping chain IDs to viem chain definitions
 */
const CHAINS = {
  31337: hardhat,
  11155111: sepolia,
  1: mainnet,
} as const;

type SupportedChainId = keyof typeof CHAINS;

/**
 * Get chain ID from environment variable, default to 31337 (Hardhat)
 */
function getChainId(): SupportedChainId {
  const chainId = Number(process.env.CHAIN_ID) || 31337;
  if (!(chainId in CHAINS)) {
    throw new Error(
      `Unsupported chain ID: ${chainId}. Supported chains: ${Object.keys(CHAINS).join(", ")}`
    );
  }
  return chainId as SupportedChainId;
}

/**
 * Get RPC URLs from environment variables with defaults for local network
 */
function getRpcUrls() {
  const chainId = getChainId();
  const isLocal = chainId === 31337;

  return {
    http:
      process.env.RPC_URL ||
      (isLocal ? "http://127.0.0.1:8545" : undefined),
    ws:
      process.env.WS_RPC_URL ||
      (isLocal ? "ws://127.0.0.1:8545" : undefined),
  };
}

/**
 * Exponential backoff retry helper
 * @param fn Function to retry
 * @param retries Maximum number of retry attempts (default: 3)
 * @param initialDelay Initial delay in milliseconds (default: 1000)
 * @returns Promise that resolves with the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        // Exponential backoff: delay * 2^attempt
        const waitTime = delay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error("Retry failed");
}

/**
 * Create transport with WebSocket primary and HTTP fallback
 * Uses viem's fallback utility to automatically fallback to HTTP if WebSocket fails
 */
function createTransport() {
  const { http: httpUrl, ws: wsUrl } = getRpcUrls();

  if (!httpUrl) {
    throw new Error(
      "RPC_URL environment variable is required for non-local networks"
    );
  }

  const transports = [];

  // Add WebSocket transport first (primary) if available
  if (wsUrl) {
    try {
      transports.push(webSocket(wsUrl));
    } catch (error) {
      // If WebSocket fails to initialize, log warning
      console.warn(
        `⚠️  WebSocket transport unavailable, will use HTTP only: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Always add HTTP as fallback
  transports.push(http(httpUrl));

  // If only one transport, return it directly
  if (transports.length === 1) {
    return transports[0];
  }

  // Use fallback to try WebSocket first, then HTTP
  return fallback(transports);
}

// Singleton instances
let publicClientInstance: PublicClient | null = null;
let walletClientInstance: WalletClient | null = null;
let chainInstance: Chain | null = null;

/**
 * Reset singleton instances (useful for testing)
 * @internal
 */
export function resetInstances() {
  publicClientInstance = null;
  walletClientInstance = null;
  chainInstance = null;
}

/**
 * Get the configured chain for the current CHAIN_ID
 */
export function getChain(): Chain {
  if (!chainInstance) {
    const chainId = getChainId();
    chainInstance = CHAINS[chainId];
  }
  return chainInstance;
}

/**
 * Get or create the public client (singleton)
 */
export function getPublicClient(): PublicClient {
  if (!publicClientInstance) {
    const chain = getChain();
    const transport = createTransport();

    publicClientInstance = createPublicClient({
      chain,
      transport,
    });

    // Log connection info at startup
    const { http: httpUrl, ws: wsUrl } = getRpcUrls();
    console.log(`🔗 Connected to chain: ${chain.name} (chainId: ${chain.id})`);
    console.log(`   RPC: ${httpUrl}`);
    if (wsUrl) {
      console.log(`   WS:  ${wsUrl}`);
    } else {
      console.log(`   WS:  (not configured)`);
    }
  }

  return publicClientInstance;
}

/**
 * Get or create the wallet client (singleton, optional)
 * Returns null if ADMIN_PRIVATE_KEY is not set
 */
export function getWalletClient(): WalletClient | null {
  if (!process.env.ADMIN_PRIVATE_KEY) {
    return null;
  }

  if (!walletClientInstance) {
    const chain = getChain();
    const { http: httpUrl } = getRpcUrls();

    if (!httpUrl) {
      throw new Error("RPC_URL is required for wallet client");
    }

    const account = privateKeyToAccount(
      process.env.ADMIN_PRIVATE_KEY as `0x${string}`
    );

    walletClientInstance = createWalletClient({
      account,
      chain,
      transport: http(httpUrl),
    });
  }

  return walletClientInstance;
}

/**
 * Test connection to the RPC endpoint
 * @returns Promise that resolves to true if connection is successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = getPublicClient();
    const chainId = await withRetry(() => client.getChainId(), 3, 1000);

    const expectedChainId = getChainId();
    if (chainId !== expectedChainId) {
      throw new Error(
        `Chain ID mismatch: expected ${expectedChainId}, got ${chainId}`
      );
    }

    return true;
  } catch (error) {
    const { http: httpUrl } = getRpcUrls();
    const chainName = getChain().name;

    if (error instanceof Error) {
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("connect")
      ) {
        throw new Error(
          `❌ Cannot connect to ${chainName} node at ${httpUrl}. ` +
            `Make sure the Hardhat node is running (npx hardhat node) or the RPC URL is correct.`
        );
      }
      throw new Error(
        `❌ Connection test failed for ${chainName}: ${error.message}`
      );
    }

    throw new Error(`❌ Connection test failed for ${chainName}: Unknown error`);
  }
}

