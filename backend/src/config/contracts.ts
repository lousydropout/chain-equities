/**
 * @file Contract address and ABI configuration loader
 * @notice Centralizes contract metadata (addresses + ABIs) for indexer and API use
 * @notice Loads contract addresses from environment variables or deployments.json fallback
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Abi } from "viem";

/**
 * Deployment JSON structure from contracts/exports/deployments.json
 */
interface DeploymentJson {
  networks: {
    [chainId: string]: {
      [companyName: string]: {
        capTable: string;
        token: string;
      };
    };
  };
}

/**
 * Get contract address from environment variable or deployments.json fallback
 */
function getContractAddress(
  envVar: string | undefined,
  deploymentsPath: string,
  contractType: "capTable" | "token"
): string {
  // First try environment variable
  if (envVar) {
    return envVar;
  }

  // Fallback to deployments.json
  let deploymentData: DeploymentJson;

  try {
    const fileContent = readFileSync(deploymentsPath, "utf-8");
    deploymentData = JSON.parse(fileContent);
  } catch (error: any) {
    throw new Error(
      `Failed to load deployments.json from ${deploymentsPath}: ${error.message}. ` +
        `Make sure contracts have been deployed and exports generated, or set ${contractType.toUpperCase()}_ADDRESS environment variable.`
    );
  }

  // Validate structure
  if (!deploymentData.networks) {
    throw new Error(
      'Invalid deployments.json structure: missing "networks" field'
    );
  }

  const defaultChainId = "31337"; // Local Anvil network
  const networkData = deploymentData.networks[defaultChainId];
  if (!networkData) {
    throw new Error(
      `No deployment found for chainId ${defaultChainId}. ` +
        `Available chainIds: ${Object.keys(deploymentData.networks).join(", ")}`
    );
  }

  const companyData = networkData["AcmeInc"];
  if (!companyData) {
    throw new Error(
      `No deployment found for company "AcmeInc" on chainId ${defaultChainId}. ` +
        `Available companies: ${Object.keys(networkData).join(", ")}`
    );
  }

  const address = companyData[contractType];
  if (!address || address.length === 0) {
    throw new Error(`Invalid ${contractType} address: address is empty`);
  }

  return address;
}

/**
 * Load ABI from exports directory
 */
function loadAbi(abiName: string): Abi {
  const currentDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));

  const abiPath = join(
    currentDir,
    "../../../contracts/exports/abis",
    `${abiName}.json`
  );

  try {
    const fileContent = readFileSync(abiPath, "utf-8");
    return JSON.parse(fileContent) as Abi;
  } catch (error: any) {
    throw new Error(
      `Failed to load ABI from ${abiPath}: ${error.message}. ` +
        `Make sure contracts have been compiled and ABIs exported.`
    );
  }
}

// Resolve paths
const currentDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const deploymentsPath = join(
  currentDir,
  "../../../contracts/exports/deployments.json"
);

// Load contract addresses (env vars or deployments.json fallback)
const capTableAddress = getContractAddress(
  process.env.CAPTABLE_ADDRESS,
  deploymentsPath,
  "capTable"
);

const tokenAddress = getContractAddress(
  process.env.TOKEN_ADDRESS,
  deploymentsPath,
  "token"
);

// Load ABIs
const capTableAbi = loadAbi("CapTable");
const tokenAbi = loadAbi("ChainEquityToken");

/**
 * Centralized contract metadata configuration
 * Contains both addresses and ABIs for easy access throughout the application
 */
export const CONTRACTS = {
  capTable: {
    address: capTableAddress as `0x${string}`,
    abi: capTableAbi,
  },
  token: {
    address: tokenAddress as `0x${string}`,
    abi: tokenAbi,
  },
} as const;

/**
 * Legacy export for backward compatibility
 * @deprecated Use CONTRACTS instead
 */
export const contracts = {
  chainId: "31337",
  capTableAddress: capTableAddress,
  tokenAddress: tokenAddress,
} as const;
