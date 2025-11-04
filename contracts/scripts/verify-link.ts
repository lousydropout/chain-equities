import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Verification script to confirm that CapTable and Token are properly linked
 * after deployment.
 * 
 * Reads addresses from exports/deployments.json and verifies:
 * - Token is linked to CapTable
 * - Token address matches expected value
 * 
 * This script can run under Hardhat or standalone (e.g. Bun/Node).
 * Falls back to a local RPC provider if Hardhat's runtime is not injected.
 */
async function main() {
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

  // Check network connection and get network information
  let network;
  try {
    network = await provider.getNetwork();
    console.log(`Connected to chain ${network.chainId}`);
  } catch (err) {
    console.error("❌ Failed to connect to network. Ensure Anvil or Hardhat node is running.");
    console.error(err.message);
    process.exit(1);
  }

  const chainId = network.chainId.toString();
  console.log(`Verifying linkage for chain ID: ${chainId}\n`);

  // Path to deployments file
  const deploymentsPath = path.join(
    __dirname,
    "..",
    "exports",
    "deployments.json"
  );

  // Check if deployments file exists
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(
      `Deployments file not found at ${deploymentsPath}. Please run export-addresses.ts first.`
    );
  }

  // Read deployments
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));

  // Get addresses for current network
  const networkDeployments = deployments.networks?.[chainId];
  if (!networkDeployments) {
    throw new Error(
      `No deployments found for chain ID ${chainId} in deployments.json`
    );
  }

  const acmeDeployment = networkDeployments["AcmeInc"];
  if (!acmeDeployment) {
    throw new Error(
      `AcmeInc deployment not found for chain ID ${chainId} in deployments.json`
    );
  }

  const { capTable: capTableAddress, token: tokenAddress } = acmeDeployment;

  console.log(`CapTable address: ${capTableAddress}`);
  console.log(`Token address: ${tokenAddress}\n`);

  // Load CapTable contract - use Hardhat if available, otherwise use ethers directly
  let capTable;
  if (useHardhatContracts) {
    capTable = await hre.ethers.getContractAt("CapTable", capTableAddress);
  } else {
    // Load contract ABI from Hardhat artifacts
    const capTableArtifact = await import(
      `../artifacts/contracts/CapTable.sol/CapTable.json`
    );
    const { ethers } = await import("ethers");
    capTable = new ethers.Contract(
      capTableAddress,
      capTableArtifact.abi,
      provider
    );
  }

  // Verify token is linked
  const isTokenLinked = await capTable.isTokenLinked();
  console.log(`Token linked: ${isTokenLinked}`);

  // Get linked token address from CapTable
  const linkedTokenAddress = await capTable.token();
  console.log(`Linked token address (from CapTable): ${linkedTokenAddress}`);

  // Verify addresses match
  if (linkedTokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
    console.log(`\n✅ Verification successful: Token address matches!`);
  } else {
    console.error(
      `\n❌ Verification failed: Token addresses do not match!\n  Expected: ${tokenAddress}\n  Actual: ${linkedTokenAddress}`
    );
    process.exit(1);
  }

  // Additional verification: Check token contract exists
  try {
    let token;
    if (useHardhatContracts) {
      token = await hre.ethers.getContractAt(
        "ChainEquityToken",
        tokenAddress
      );
    } else {
      const tokenArtifact = await import(
        `../artifacts/contracts/ChainEquityToken.sol/ChainEquityToken.json`
      );
      const { ethers } = await import("ethers");
      token = new ethers.Contract(
        tokenAddress,
        tokenArtifact.abi,
        provider
      );
    }
    const tokenName = await token.name();
    const tokenSymbol = await token.symbol();
    console.log(`\nToken contract verified:`);
    console.log(`  Name: ${tokenName}`);
    console.log(`  Symbol: ${tokenSymbol}`);
  } catch (error) {
    console.error(`\n❌ Failed to verify token contract: ${error}`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

