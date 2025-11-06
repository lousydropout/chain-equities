/**
 * @file Wagmi configuration for wallet connectivity
 * @notice Configures Wagmi with Hardhat local network and Sepolia testnet
 */

import { createConfig, http } from 'wagmi';
import { hardhat, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

const chains = [hardhat, sepolia] as const;

/**
 * Wagmi configuration with Hardhat local and Sepolia testnet
 * - Auto-connect enabled for seamless wallet connections
 * - HTTP transports configured for both chains
 * - Hardhat local network points to http://127.0.0.1:8545
 * - Injected connector (MetaMask, etc.) configured
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
