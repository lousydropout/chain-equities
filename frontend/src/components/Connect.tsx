/**
 * @file Wallet connection component using Wagmi
 * @notice Provides UI for connecting/disconnecting MetaMask wallet
 */

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import './Connect.css';

/**
 * Formats an Ethereum address for display
 * @param address - Full Ethereum address
 * @returns Formatted address (e.g., "0x1234...5678")
 */
function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Connect component for wallet connection UI
 * Handles connection states, displays address, and provides connect/disconnect buttons
 */
export function Connect() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // Get the injected connector (MetaMask)
  const injectedConnector = connectors[0];

  // Handle connect button click
  const handleConnect = () => {
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  // Handle disconnect button click
  const handleDisconnect = () => {
    disconnect();
  };

  // Determine connection status message
  const getStatusMessage = (): string => {
    if (isConnecting || isPending) {
      return 'Connecting…';
    }
    if (isReconnecting) {
      return 'Reconnecting…';
    }
    if (isConnected && address) {
      return 'Connected';
    }
    if (connectError) {
      return `Error: ${connectError.message || 'Connection failed'}`;
    }
    return 'Not connected';
  };

  // Determine if there's an error
  const hasError = !!connectError;

  return (
    <div className="connect-card">
      <div className="connect-header">
        <h3>Wallet Connection</h3>
        <span
          className={`connect-status ${isConnected ? 'status-connected' : hasError ? 'status-error' : 'status-disconnected'}`}
        >
          {getStatusMessage()}
        </span>
      </div>

      {isConnected && address ? (
        <div className="connect-content">
          <div className="connect-address">
            <span className="address-label">Address:</span>
            <span className="address-value" title={address}>
              {formatAddress(address)}
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            className="connect-button disconnect-button"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="connect-content">
          <p className="connect-description">
            Connect your MetaMask wallet to interact with the blockchain.
          </p>
          <button
            onClick={handleConnect}
            disabled={isConnecting || isPending || !injectedConnector}
            className="connect-button connect-button-primary"
          >
            {isConnecting || isPending ? 'Connecting…' : 'Connect Wallet'}
          </button>
          {hasError && (
            <div className="connect-error">
              <p>{connectError.message || 'Failed to connect wallet'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
