/**
 * @file Contract configuration for ChainEquity frontend
 * @notice Simple contract config with ABI import for ChainEquityToken
 */

import abiData from '../../../contracts/exports/abis/ChainEquityToken.json';
import type { Abi } from 'viem';

// Type assertion for JSON import
const abi = abiData as Abi;

/**
 * ChainEquityToken contract configuration
 * ABI is loaded from exported artifacts, address can come from env var or API
 */
export const chainEquityToken = {
  abi,
  // Address can be set via env var or from useCompanyStats() hook
  // For demo: single token contract, address will be provided via props/hook
} as const;

