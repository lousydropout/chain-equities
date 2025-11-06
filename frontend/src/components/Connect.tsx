/**
 * @file Wallet connection component using Wagmi
 * @notice Provides UI for connecting/disconnecting MetaMask wallet
 */

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  // Ensure connectors are available before accessing
  const injectedConnector = connectors && connectors.length > 0 ? connectors[0] : null;

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

  // Get status badge className
  const getStatusBadgeClass = (): string => {
    if (isConnected) {
      return 'bg-green-500/20 text-green-500';
    }
    if (hasError) {
      return 'bg-red-500/20 text-red-500';
    }
    return 'bg-gray-500/20 text-gray-500';
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Wallet Connection</CardTitle>
          <span
            className={`px-3 py-1 rounded-md text-sm font-medium ${getStatusBadgeClass()}`}
          >
            {getStatusMessage()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && address ? (
          <>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
              <span className="text-muted-foreground">Address:</span>
              <span className="text-primary font-semibold" title={address}>
                {formatAddress(address)}
              </span>
            </div>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              className="w-full"
            >
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your MetaMask wallet to interact with the blockchain.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting || isPending || !injectedConnector}
              className="w-full"
            >
              {isConnecting || isPending ? 'Connecting…' : 'Connect Wallet'}
            </Button>
            {hasError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  {connectError.message || 'Failed to connect wallet'}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
