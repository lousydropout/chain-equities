import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deployment module for ChainEquityToken
 *
 * Example: Deploy Acme Inc. with 1,000,000 authorized shares
 */
export default buildModule("ChainEquityTokenModule", (m) => {
  const token = m.contract("ChainEquityToken", [
    "Acme Inc. Equity", // name
    "ACME", // symbol
    1_000_000n * 10n ** 18n, // totalAuthorized (1M shares with 18 decimals)
  ]);

  return { token };
});
