/**
 * @file Network Auto-Switch Hook
 * @notice Automatically switches users to localnet (Hardhat, chainId 31337) when wallet connects
 * @notice Adds localnet to MetaMask if not present, then switches to it
 */

import { useEffect, useRef, useState } from 'react';
import { useChainId, useSwitchChain, useAccount } from 'wagmi';
import { hardhat } from 'wagmi/chains';

/**
 * Type declaration for window.ethereum
 */
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

/**
 * Expected chain ID for localnet (Hardhat)
 */
const LOCALNET_CHAIN_ID = hardhat.id; // 31337

/**
 * Add localnet to MetaMask using the provider directly
 */
async function addLocalnetToMetaMask(): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  const chainIdHex = `0x${LOCALNET_CHAIN_ID.toString(16)}`;

  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: 'Hardhat Local',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: ['http://127.0.0.1:8545'],
          blockExplorerUrls: null,
        },
      ],
    });
  } catch (error: any) {
    // Error code 4902 means the chain is already added, which is fine
    if (error.code !== 4902) {
      throw error;
    }
  }
}

/**
 * Hook to automatically switch to localnet when wallet connects
 * Adds the network to MetaMask if needed, then switches to it
 * @returns Network validation state and switch function
 */
export function useNetworkAutoSwitch() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<Error | null>(null);
  const attemptingRef = useRef(false);

  const isCorrectNetwork = chainId === LOCALNET_CHAIN_ID;
  const isProcessing = isSwitching || isAdding;
  const error = switchError || addError;

  // Monitor switchError to detect when chain needs to be added, and reset on success
  useEffect(() => {
    if (switchError && attemptingRef.current) {
      const err = switchError as any;
      // If switch fails with error code 4902, it means chain not added to wallet
      // Error code 4902: "Unrecognized chain ID"
      if (err?.code === 4902 || err?.cause?.code === 4902) {
        // Add the chain using MetaMask's API directly
        setIsAdding(true);
        addLocalnetToMetaMask()
          .then(() => {
            // After adding, switch to it
            switchChain({ chainId: LOCALNET_CHAIN_ID });
          })
          .catch((addErr) => {
            console.error('Failed to add or switch to localnet:', addErr);
            setAddError(addErr instanceof Error ? addErr : new Error(String(addErr)));
            attemptingRef.current = false;
          })
          .finally(() => {
            setIsAdding(false);
          });
      } else {
        // Other switch errors
        console.error('Failed to switch to localnet:', switchError);
        attemptingRef.current = false;
      }
    } else if (!switchError && !isSwitching && isCorrectNetwork && attemptingRef.current) {
      // Switch succeeded - we're on the correct network now
      attemptingRef.current = false;
    }
  }, [switchError, switchChain, isSwitching, isCorrectNetwork]);

  // Automatically add and switch to localnet when wallet connects and is on wrong network
  useEffect(() => {
    if (isConnected && !isCorrectNetwork && !isProcessing && !attemptingRef.current) {
      attemptingRef.current = true;
      setAddError(null);
      
      // Try to switch first - if the chain is already added, this will work
      // Errors will be handled via switchError in the effect above
      switchChain({ chainId: LOCALNET_CHAIN_ID });
    } else if (isCorrectNetwork) {
      // Reset attempt flag when on correct network
      attemptingRef.current = false;
      setAddError(null);
    }
  }, [isConnected, isCorrectNetwork, isProcessing, switchChain]);

  /**
   * Manual function to add and switch to localnet
   * Can be called by user if automatic switch fails
   * Note: switchChain returns void, so errors are handled via switchError in the effect above
   */
  const manualSwitch = async () => {
    attemptingRef.current = true;
    setAddError(null);
    // Try to switch first - if the chain is not added, the effect above will handle it
    switchChain({ chainId: LOCALNET_CHAIN_ID });
    // Note: We don't await here because switchChain returns void.
    // Errors will be handled by the useEffect that monitors switchError.
    // If the chain needs to be added, the effect will handle it automatically.
  };

  return {
    isCorrectNetwork,
    chainId,
    isSwitching: isProcessing,
    switchError: error,
    expectedChainId: LOCALNET_CHAIN_ID,
    manualSwitch,
  };
}

