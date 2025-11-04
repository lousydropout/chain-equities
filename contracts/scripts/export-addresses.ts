import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Script to export deployed contract addresses from Hardhat Ignition artifacts
 * to a structured JSON file for backend/frontend consumption.
 * 
 * Reads addresses from ignition/deployments/chain-{chainId}/deployed_addresses.json
 * and writes to exports/deployments.json in nested format.
 * 
 * This script can run under Hardhat or standalone (e.g. Bun/Node).
 * Falls back to a local RPC provider if Hardhat's runtime is not injected.
 */
async function main() {
  // Get provider - try Hardhat runtime first, fallback to local RPC
  let provider;
  try {
    provider = hre.ethers.provider;
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
  console.log(`Exporting addresses for chain ID: ${chainId}`);

  // Path to Ignition deployment artifacts
  const ignitionDeploymentsPath = path.join(
    __dirname,
    "..",
    "ignition",
    "deployments",
    `chain-${chainId}`,
    "deployed_addresses.json"
  );

  // Check if deployment file exists
  if (!fs.existsSync(ignitionDeploymentsPath)) {
    throw new Error(
      `Deployment file not found at ${ignitionDeploymentsPath}. Please deploy contracts first.`
    );
  }

  // Read deployed addresses from Ignition
  const deployedAddresses = JSON.parse(
    fs.readFileSync(ignitionDeploymentsPath, "utf-8")
  );

  // Extract addresses for AcmeCompany module
  const tokenAddress = deployedAddresses["AcmeCompany#ChainEquityToken"];
  const capTableAddress = deployedAddresses["AcmeCompany#CapTable"];

  if (!tokenAddress || !capTableAddress) {
    throw new Error(
      "Could not find AcmeCompany deployment addresses. Ensure AcmeCompany module has been deployed."
    );
  }

  console.log(`Token address: ${tokenAddress}`);
  console.log(`CapTable address: ${capTableAddress}`);

  // Path to exports file
  const exportsPath = path.join(__dirname, "..", "exports", "deployments.json");

  // Read existing deployments.json if it exists, or create new structure
  let deployments: {
    networks: {
      [chainId: string]: {
        [company: string]: {
          capTable: string;
          token: string;
        };
      };
    };
  };

  if (fs.existsSync(exportsPath)) {
    deployments = JSON.parse(fs.readFileSync(exportsPath, "utf-8"));
  } else {
    deployments = { networks: {} };
  }

  // Ensure networks structure exists
  if (!deployments.networks) {
    deployments.networks = {};
  }

  // Update or create network entry
  if (!deployments.networks[chainId]) {
    deployments.networks[chainId] = {};
  }

  // Update AcmeInc company entry
  deployments.networks[chainId]["AcmeInc"] = {
    capTable: capTableAddress,
    token: tokenAddress,
  };

  // Ensure exports directory exists
  const exportsDir = path.dirname(exportsPath);
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  // Write updated deployments.json
  fs.writeFileSync(exportsPath, JSON.stringify(deployments, null, 2));

  console.log(`\nAddresses exported to ${exportsPath}`);
  console.log(JSON.stringify(deployments, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

