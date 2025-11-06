/**
 * @file Wagmi configuration for wallet connectivity
 * @notice Configures Wagmi with Hardhat local network only
 * @notice Auto-switches to localnet (chainId 31337) when wallet connects
 */

import { createConfig, http } from 'wagmi';
import { hardhat } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Only Hardhat localnet - restricts MetaMask to only request this network
// Auto-switching to localnet happens automatically via useNetworkAutoSwitch hook
const chains = [hardhat] as const;

/**
 * Wagmi configuration with Hardhat local network only
 * - Restricts MetaMask connection to only request Hardhat localnet
 * - HTTP transport configured for Hardhat
 * - Hardhat local network points to http://127.0.0.1:8545
 * - Injected connector (MetaMask, etc.) configured
 * - Expected network: Localnet (Hardhat, chainId 31337)
 * - Users are automatically switched to localnet on wallet connection
 */
export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
  ssr: false,
});
