#!/usr/bin/env bun
/**
 * @file Manual test script for Viem client configuration
 * @notice Tests client initialization and connection to blockchain node
 * @usage bun run scripts/test-client.ts
 */

import {
  getPublicClient,
  getWalletClient,
  getChain,
  testConnection,
} from "../src/services/chain/client";

async function main() {
  console.log("🧪 Testing Viem Client Configuration\n");

  try {
    // Test 1: Chain Configuration
    console.log("1️⃣ Testing chain configuration...");
    const chain = getChain();
    console.log(`   ✅ Chain: ${chain.name} (chainId: ${chain.id})`);

    // Test 2: Public Client
    console.log("\n2️⃣ Testing public client initialization...");
    const publicClient = getPublicClient();
    console.log("   ✅ Public client created");

    // Test 3: Wallet Client
    console.log("\n3️⃣ Testing wallet client...");
    const walletClient = getWalletClient();
    if (walletClient) {
      console.log("   ✅ Wallet client created (ADMIN_PRIVATE_KEY set)");
    } else {
      console.log("   ℹ️  Wallet client not available (ADMIN_PRIVATE_KEY not set)");
    }

    // Test 4: Connection Test
    console.log("\n4️⃣ Testing connection to blockchain node...");
    try {
      const isConnected = await testConnection();
      if (isConnected) {
        console.log("   ✅ Connection successful!");
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`   ❌ Connection failed: ${error.message}`);
        console.log("\n💡 Tip: Make sure Hardhat node is running:");
        console.log("   npx hardhat node");
      } else {
        throw error;
      }
    }

    // Test 5: Get Chain ID
    console.log("\n5️⃣ Testing getChainId()...");
    try {
      const chainId = await publicClient.getChainId();
      console.log(`   ✅ Chain ID: ${chainId}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`   ❌ Failed to get chain ID: ${error.message}`);
      }
    }

    // Test 6: Get Block Number
    console.log("\n6️⃣ Testing getBlockNumber()...");
    try {
      const blockNumber = await publicClient.getBlockNumber();
      console.log(`   ✅ Current block number: ${blockNumber}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`   ❌ Failed to get block number: ${error.message}`);
      }
    }

    console.log("\n✨ Client configuration test complete!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("   Error message:", error.message);
    }
    process.exit(1);
  }
}

main();

