import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Generic deployment module for Company deployment
 *
 * Deploys both ChainEquityToken and CapTable contracts, then links them together.
 * This module ensures deterministic deployment order: token → capTable → link.
 *
 * This module can be customized by modifying the parameters directly in the module,
 * or by creating a new module file that imports and uses this pattern.
 *
 * For a reusable factory function, see the documentation.
 */
export default buildModule("CompanyModule", (m) => {
  // Configuration - customize these values for your deployment
  const companyName = "Acme Inc.";
  const companySymbol = "ACME";
  const tokenName = "Acme Inc. Equity";
  const totalAuthorized = 1_000_000n * 10n ** 18n; // 1M shares with 18 decimals

  // Step 1: Deploy ChainEquityToken
  const token = m.contract("ChainEquityToken", [
    tokenName,
    companySymbol,
    // Use bigint for portability and consistency with existing modules.
    // Equivalent to parseEther() but does not depend on Hardhat runtime.
    totalAuthorized,
  ]);

  // Step 2: Deploy CapTable
  const capTable = m.contract("CapTable", [companyName, companySymbol]);

  // Step 3: Link token to cap table (must happen after both are deployed)
  m.call(capTable, "linkToken", [token]);

  return { token, capTable };
});
