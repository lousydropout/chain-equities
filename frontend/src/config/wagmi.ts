/**
 * @file Wagmi configuration for wallet connectivity
 * @notice Configures Wagmi with Hardhat local network and Sepolia testnet
 * @notice Auto-switches to localnet (chainId 31337) when wallet connects
 */

import { createConfig, http } from 'wagmi';
import { hardhat, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Hardhat localnet and Sepolia testnet
// Auto-switching to localnet happens automatically via useNetworkAutoSwitch hook
const chains = [hardhat, sepolia] as const;

/**
 * Wagmi configuration with Hardhat local network and Sepolia testnet
 * - HTTP transport configured for Hardhat and Sepolia
 * - Hardhat local network points to http://127.0.0.1:8545
 * - Sepolia uses public RPC endpoint
 * - Injected connector (MetaMask, etc.) configured
 * - Expected networks: Localnet (Hardhat, chainId 31337) and Sepolia (chainId 11155111)
 * - Users are automatically switched to localnet on wallet connection
 */
export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
  },
  ssr: false,
});
