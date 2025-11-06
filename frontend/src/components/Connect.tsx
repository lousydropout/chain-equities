/**
 * @file Wallet connection component using Wagmi
 * @notice Provides UI for connecting/disconnecting MetaMask wallet
 */

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNetworkAutoSwitch } from '@/hooks/useNetworkAutoSwitch';
import { Loader2, AlertCircle } from 'lucide-react';

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
  const { isCorrectNetwork, isSwitching, switchError, manualSwitch } = useNetworkAutoSwitch();

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
    if (isSwitching) {
      return 'Switching to Localnet…';
    }
    if (isConnecting || isPending) {
      return 'Connecting…';
    }
    if (isReconnecting) {
      return 'Reconnecting…';
    }
    if (isConnected && address) {
      if (isCorrectNetwork) {
        return 'Connected to Localnet';
      }
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
        {/* Network switching status */}
        {isConnected && isSwitching && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">
                Adding Localnet to MetaMask and switching... Please confirm in MetaMask
              </span>
            </div>
            <p className="text-xs text-blue-500/80 mt-1">
              You may see two MetaMask popups: one to add the network, one to switch to it.
            </p>
          </div>
        )}

        {/* Network switch error */}
        {isConnected && switchError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <div className="flex-1">
                <p className="text-sm font-medium">Failed to switch network</p>
                <p className="text-xs mt-1">
                  {switchError.message || 'Please manually switch to Localnet (chainId 31337)'}
                </p>
              </div>
            </div>
            <Button
              onClick={manualSwitch}
              disabled={isSwitching}
              variant="outline"
              size="sm"
              className="mt-2 w-full"
            >
              {isSwitching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Switching...
                </>
              ) : (
                'Try Switch to Localnet Again'
              )}
            </Button>
          </div>
        )}

        {/* Wrong network warning */}
        {isConnected && !isCorrectNetwork && !isSwitching && !switchError && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">
                Please switch to Localnet to interact with contracts
              </p>
            </div>
          </div>
        )}

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
              disabled={isSwitching}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your MetaMask wallet to interact with the blockchain. We'll automatically switch you to Localnet (chainId 31337) when you connect.
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
