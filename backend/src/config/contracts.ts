/**
 * @file Contract address configuration loader
 * @notice Loads contract addresses from deployments.json for single-company setup
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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
 * Contract addresses configuration
 * Loaded from contracts/exports/deployments.json
 */
export const contracts = (() => {
  const defaultChainId = "31337"; // Local Anvil network

  // Resolve path to deployments.json (assuming backend is sibling to contracts)
  // Support both ESM (import.meta.url) and CommonJS (__dirname) patterns
  const currentDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));

  // From backend/src/config/contracts.ts, go up to workspace root, then into contracts
  const deploymentsPath = join(
    currentDir,
    "../../../contracts/exports/deployments.json"
  );

  let deploymentData: DeploymentJson;

  try {
    const fileContent = readFileSync(deploymentsPath, "utf-8");
    deploymentData = JSON.parse(fileContent);
  } catch (error: any) {
    throw new Error(
      `Failed to load deployments.json from ${deploymentsPath}: ${error.message}. ` +
        `Make sure contracts have been deployed and exports generated.`
    );
  }

  // Validate structure
  if (!deploymentData.networks) {
    throw new Error(
      'Invalid deployments.json structure: missing "networks" field'
    );
  }

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

  if (!companyData.capTable || !companyData.token) {
    throw new Error(
      `Invalid company deployment structure: missing "capTable" or "token" address`
    );
  }

  // Validate addresses are non-empty
  if (!companyData.capTable || companyData.capTable.length === 0) {
    throw new Error("Invalid capTable address: address is empty");
  }

  if (!companyData.token || companyData.token.length === 0) {
    throw new Error("Invalid token address: address is empty");
  }

  return {
    chainId: defaultChainId,
    capTableAddress: companyData.capTable,
    tokenAddress: companyData.token,
  } as const;
})();
