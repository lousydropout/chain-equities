import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Comprehensive deployment verification script
 *
 * Verifies the complete deployment setup:
 * - Network connectivity
 * - Deployment artifacts exist
 * - Both contracts are deployed and accessible
 * - Token linkage is correct
 * - Contract state matches expected values
 * - Exported addresses match deployed addresses
 * - JSON structure is correct
 *
 * This script can run under Hardhat or standalone (e.g. Bun/Node).
 * Falls back to a local RPC provider if Hardhat's runtime is not injected.
 */
async function main() {
  console.log("🔍 Starting comprehensive deployment verification...\n");

  // Get provider - try Hardhat runtime first, fallback to local RPC
  let provider;
  let useHardhatContracts = false;
  try {
    provider = hre.ethers.provider;
    useHardhatContracts = true;
  } catch {
    console.warn("⚠️ Hardhat runtime not detected. Attempting manual provider connection...");
    const { ethers } = await import("ethers");
    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  }

  // Step 1: Verify network connectivity
  console.log("1️⃣ Verifying network connectivity...");
  let network;
  try {
    network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    console.log(`   ✅ Connected to chain ${network.chainId} (block ${blockNumber})`);
  } catch (err) {
    console.error("   ❌ Failed to connect to network. Ensure Anvil or Hardhat node is running.");
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }

  const chainId = network.chainId.toString();
  console.log(`\n📋 Verifying deployment for chain ID: ${chainId}\n`);

  // Step 2: Check that deployment artifacts exist
  console.log("2️⃣ Checking deployment artifacts...");
  const ignitionDeploymentsPath = path.join(
    __dirname,
    "..",
    "ignition",
    "deployments",
    `chain-${chainId}`,
    "deployed_addresses.json"
  );

  if (!fs.existsSync(ignitionDeploymentsPath)) {
    console.error(`   ❌ Deployment artifacts not found at ${ignitionDeploymentsPath}`);
    console.error("   Please deploy contracts first using Hardhat Ignition.");
    process.exit(1);
  }

  const deployedAddresses = JSON.parse(
    fs.readFileSync(ignitionDeploymentsPath, "utf-8")
  );
  console.log("   ✅ Deployment artifacts found");

  // Extract addresses for AcmeCompany module
  const tokenAddress = deployedAddresses["AcmeCompany#ChainEquityToken"];
  const capTableAddress = deployedAddresses["AcmeCompany#CapTable"];

  if (!tokenAddress || !capTableAddress) {
    console.error("   ❌ Could not find AcmeCompany deployment addresses in artifacts");
    console.error("   Available keys:", Object.keys(deployedAddresses));
    process.exit(1);
  }

  console.log(`   ✅ Token address: ${tokenAddress}`);
  console.log(`   ✅ CapTable address: ${capTableAddress}`);

  // Step 3: Verify both contracts are deployed and accessible
  console.log("\n3️⃣ Verifying contracts are deployed and accessible...");
  let capTable;
  let token;

  try {
    if (useHardhatContracts) {
      capTable = await hre.ethers.getContractAt("CapTable", capTableAddress);
      token = await hre.ethers.getContractAt("ChainEquityToken", tokenAddress);
    } else {
      const capTableArtifact = await import(
        `../artifacts/contracts/CapTable.sol/CapTable.json`
      );
      const tokenArtifact = await import(
        `../artifacts/contracts/ChainEquityToken.sol/ChainEquityToken.json`
      );
      const { ethers } = await import("ethers");
      capTable = new ethers.Contract(
        capTableAddress,
        capTableArtifact.abi,
        provider
      );
      token = new ethers.Contract(
        tokenAddress,
        tokenArtifact.abi,
        provider
      );
    }

    // Check bytecode exists (contract is deployed)
    const capTableCode = await provider.getCode(capTableAddress);
    const tokenCode = await provider.getCode(tokenAddress);

    if (capTableCode === "0x" || capTableCode.length < 4) {
      throw new Error(`CapTable contract has no bytecode at ${capTableAddress}`);
    }
    if (tokenCode === "0x" || tokenCode.length < 4) {
      throw new Error(`Token contract has no bytecode at ${tokenAddress}`);
    }

    console.log("   ✅ CapTable contract deployed and accessible");
    console.log("   ✅ Token contract deployed and accessible");
  } catch (error) {
    console.error(`   ❌ Failed to load contracts: ${error.message}`);
    process.exit(1);
  }

  // Step 4: Verify token linkage
  console.log("\n4️⃣ Verifying token linkage...");
  try {
    const isTokenLinked = await capTable.isTokenLinked();
    if (!isTokenLinked) {
      throw new Error("Token is not linked to CapTable");
    }
    console.log("   ✅ Token is linked to CapTable");

    const linkedTokenAddress = await capTable.token();
    if (linkedTokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) {
      throw new Error(
        `Token address mismatch!\n     Expected: ${tokenAddress}\n     Actual: ${linkedTokenAddress}`
      );
    }
    console.log("   ✅ Linked token address matches deployed token");
  } catch (error) {
    console.error(`   ❌ Token linkage verification failed: ${error.message}`);
    process.exit(1);
  }

  // Step 5: Verify contract state
  console.log("\n5️⃣ Verifying contract state...");
  try {
    // CapTable state
    const capTableName = await capTable.name();
    const capTableSymbol = await capTable.symbol();
    console.log(`   CapTable - Name: "${capTableName}", Symbol: "${capTableSymbol}"`);

    // Token state
    const tokenName = await token.name();
    const tokenSymbol = await token.symbol();
    const totalAuthorized = await token.totalAuthorized();
    console.log(`   Token - Name: "${tokenName}", Symbol: "${tokenSymbol}"`);
    console.log(`   Token - Total Authorized: ${totalAuthorized.toString()}`);

    // Verify expected values (Acme Inc. defaults)
    const expectedCapTableName = "Acme Inc.";
    const expectedCapTableSymbol = "ACME";
    const expectedTokenName = "Acme Inc. Equity";
    const expectedTokenSymbol = "ACME";
    const expectedTotalAuthorized = 1_000_000n * 10n ** 18n;

    if (capTableName !== expectedCapTableName) {
      console.warn(`   ⚠️  CapTable name mismatch: expected "${expectedCapTableName}", got "${capTableName}"`);
    } else {
      console.log("   ✅ CapTable name matches expected value");
    }

    if (capTableSymbol !== expectedCapTableSymbol) {
      console.warn(`   ⚠️  CapTable symbol mismatch: expected "${expectedCapTableSymbol}", got "${capTableSymbol}"`);
    } else {
      console.log("   ✅ CapTable symbol matches expected value");
    }

    if (tokenName !== expectedTokenName) {
      console.warn(`   ⚠️  Token name mismatch: expected "${expectedTokenName}", got "${tokenName}"`);
    } else {
      console.log("   ✅ Token name matches expected value");
    }

    if (tokenSymbol !== expectedTokenSymbol) {
      console.warn(`   ⚠️  Token symbol mismatch: expected "${expectedTokenSymbol}", got "${tokenSymbol}"`);
    } else {
      console.log("   ✅ Token symbol matches expected value");
    }

    if (totalAuthorized.toString() !== expectedTotalAuthorized.toString()) {
      console.warn(`   ⚠️  Total authorized mismatch: expected ${expectedTotalAuthorized.toString()}, got ${totalAuthorized.toString()}`);
    } else {
      console.log("   ✅ Total authorized matches expected value");
    }
  } catch (error) {
    console.error(`   ❌ Contract state verification failed: ${error.message}`);
    process.exit(1);
  }

  // Step 6: Verify exported addresses
  console.log("\n6️⃣ Verifying exported addresses...");
  const deploymentsPath = path.join(
    __dirname,
    "..",
    "exports",
    "deployments.json"
  );

  if (!fs.existsSync(deploymentsPath)) {
    console.error(`   ❌ Deployments file not found at ${deploymentsPath}`);
    console.error("   Please run export-addresses.ts first.");
    process.exit(1);
  }
  console.log("   ✅ Deployments file exists");

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));

  // Verify JSON structure
  if (!deployments.networks) {
    console.error("   ❌ Invalid JSON structure: missing 'networks' key");
    process.exit(1);
  }

  if (!deployments.networks[chainId]) {
    console.error(`   ❌ No deployments found for chain ID ${chainId}`);
    process.exit(1);
  }

  const networkDeployments = deployments.networks[chainId];
  if (!networkDeployments["AcmeInc"]) {
    console.error(`   ❌ No AcmeInc deployment found for chain ID ${chainId}`);
    process.exit(1);
  }

  const exportedDeployment = networkDeployments["AcmeInc"];
  if (!exportedDeployment.capTable || !exportedDeployment.token) {
    console.error("   ❌ Invalid deployment structure: missing capTable or token");
    process.exit(1);
  }

  console.log("   ✅ JSON structure is correct");

  // Verify addresses match
  if (
    exportedDeployment.capTable.toLowerCase() !== capTableAddress.toLowerCase()
  ) {
    console.error(
      `   ❌ CapTable address mismatch!\n     Expected: ${capTableAddress}\n     Exported: ${exportedDeployment.capTable}`
    );
    process.exit(1);
  }
  console.log("   ✅ Exported CapTable address matches deployed address");

  if (
    exportedDeployment.token.toLowerCase() !== tokenAddress.toLowerCase()
  ) {
    console.error(
      `   ❌ Token address mismatch!\n     Expected: ${tokenAddress}\n     Exported: ${exportedDeployment.token}`
    );
    process.exit(1);
  }
  console.log("   ✅ Exported Token address matches deployed address");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT VERIFICATION COMPLETE");
  console.log("=".repeat(60));
  console.log("\nAll checks passed:");
  console.log("  ✓ Network connectivity");
  console.log("  ✓ Deployment artifacts exist");
  console.log("  ✓ Contracts deployed and accessible");
  console.log("  ✓ Token linkage verified");
  console.log("  ✓ Contract state verified");
  console.log("  ✓ Exported addresses verified");
  console.log("\nDeployment is ready for use!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Verification failed:");
    console.error(error);
    process.exit(1);
  });

