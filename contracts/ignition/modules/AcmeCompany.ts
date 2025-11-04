import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deployment module for Acme Inc. Company
 * 
 * Deploys both ChainEquityToken and CapTable contracts, then links them together.
 * This module ensures deterministic deployment order: token → capTable → link.
 */
export default buildModule("AcmeCompany", (m) => {
  // Step 1: Deploy ChainEquityToken
  const token = m.contract("ChainEquityToken", [
    "Acme Inc. Equity", // name
    "ACME", // symbol
    // Use bigint for portability and consistency with existing modules.
    // Equivalent to parseEther("1000000") but does not depend on Hardhat runtime.
    1_000_000n * 10n ** 18n, // totalAuthorized (1M shares with 18 decimals)
  ]);

  // Step 2: Deploy CapTable
  const capTable = m.contract("CapTable", [
    "Acme Inc.", // name
    "ACME", // symbol
  ]);

  // Step 3: Link token to cap table (must happen after both are deployed)
  m.call(capTable, "linkToken", [token]);

  return { token, capTable };
});

