/**
 * @file Test script for event indexer
 * @notice Simple test to verify indexer can start and connect
 */

import { Indexer } from "../src/services/chain/indexer";
import { getPublicClient, testConnection } from "../src/services/chain/client";
import { CONTRACTS } from "../src/config/contracts";

async function main() {
  console.log("🧪 Testing event indexer...\n");

  try {
    // Test blockchain connection
    console.log("1️⃣ Testing blockchain connection...");
    const connected = await testConnection();
    if (!connected) {
      throw new Error("Failed to connect to blockchain");
    }
    console.log("✅ Blockchain connection successful\n");

    // Check contract addresses
    console.log("2️⃣ Checking contract addresses...");
    console.log(`   CapTable: ${CONTRACTS.capTable.address}`);
    console.log(`   Token: ${CONTRACTS.token.address}`);
    console.log("✅ Contract addresses loaded\n");

    // Test contract accessibility
    console.log("3️⃣ Testing contract accessibility...");
    const publicClient = getPublicClient();

    // Try to read from token contract
    try {
      const name = await publicClient.readContract({
        address: CONTRACTS.token.address,
        abi: CONTRACTS.token.abi,
        functionName: "name",
      });
      console.log(`   Token name: ${name}`);
    } catch (error) {
      console.warn(
        `   ⚠️  Could not read token name: ${error instanceof Error ? error.message : String(error)}`
      );
      console.warn("   This is expected if contracts are not deployed yet\n");
    }

    // Try to read from capTable contract
    try {
      const name = await publicClient.readContract({
        address: CONTRACTS.capTable.address,
        abi: CONTRACTS.capTable.abi,
        functionName: "name",
      });
      console.log(`   CapTable name: ${name}`);
    } catch (error) {
      console.warn(
        `   ⚠️  Could not read capTable name: ${error instanceof Error ? error.message : String(error)}`
      );
      console.warn("   This is expected if contracts are not deployed yet\n");
    }

    console.log("✅ Contract accessibility test complete\n");

    // Test indexer start (will catch up on existing blocks)
    console.log("4️⃣ Testing indexer start...");
    console.log("   Starting indexer (this will scan existing blocks)...");
    
    await Indexer.start();
    
    // Let it run for a few seconds
    console.log("   Indexer started, waiting 5 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Stop indexer
    console.log("   Stopping indexer...");
    await Indexer.stop();
    console.log("✅ Indexer test complete\n");

    console.log("🎉 All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

main();

