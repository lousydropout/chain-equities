/**
 * @file Profile Menu Component
 * @notice Profile icon dropdown menu with wallet connection, linking, and logout functionality
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, LogOut, Link2, Unlink, Wallet, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkAutoSwitch } from '@/hooks/useNetworkAutoSwitch';
import { useWalletStatus } from '@/hooks/useApi';
import { linkWallet, unlinkWallet } from '@/lib/api';
import { formatAddress } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * ProfileMenu component
 * Provides a dropdown menu with wallet connection, linking, and logout functionality
 */
export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { isSwitching } = useNetworkAutoSwitch();
  const { data: walletStatus } = useWalletStatus();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const disconnectingRef = useRef(false); // Prevent infinite disconnect loops

  // Extract wallet status values
  const isLinked = walletStatus?.isLinked ?? false;
  const linkedWalletAddress = walletStatus?.walletAddress;

  // Get the injected connector (MetaMask)
  const injectedConnector = connectors && connectors.length > 0 ? connectors[0] : null;

  // Link wallet mutation
  const linkMutation = useMutation({
    mutationFn: (walletAddress: string) => linkWallet(walletAddress),
    onSuccess: async (data, walletAddress) => {
      queryClient.setQueryData(['wallet', 'status'], {
        walletAddress: data.walletAddress || walletAddress,
        isLinked: true,
      });
      // Invalidate and refetch queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['shareholder', 'me'] });
      // Explicitly refetch active queries for immediate update
      await queryClient.refetchQueries({ queryKey: ['shareholder', 'me'] });
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to link wallet');
    },
  });

  // Unlink wallet mutation
  const unlinkMutation = useMutation({
    mutationFn: () => unlinkWallet(),
    onSuccess: async () => {
      queryClient.setQueryData(['wallet', 'status'], {
        walletAddress: null,
        isLinked: false,
      });
      // Invalidate and refetch queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['shareholder', 'me'] });
      // Explicitly refetch active queries for immediate update
      await queryClient.refetchQueries({ queryKey: ['shareholder', 'me'] });
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to unlink wallet');
    },
  });

  // Auto-disconnect if connected wallet doesn't match linked wallet
  useEffect(() => {
    // Skip if already disconnecting, not connected, or no linked wallet
    if (disconnectingRef.current || !isConnected || !address || !isLinked || !linkedWalletAddress) {
      return;
    }

    // Compare addresses (case-insensitive)
    const connectedAddressLower = address.toLowerCase();
    const linkedAddressLower = linkedWalletAddress.toLowerCase();

    if (connectedAddressLower !== linkedAddressLower) {
      // Connected wallet doesn't match linked wallet - auto-disconnect
      disconnectingRef.current = true;
      const errorMessage = `Connected wallet (${formatAddress(address)}) doesn't match your linked wallet (${formatAddress(linkedWalletAddress)}). Disconnecting...`;
      setActionError(errorMessage);
      
      // Show alert popup
      alert(errorMessage);
      
      disconnect();
      
      // Reset flag after a longer delay to ensure user sees the message
      setTimeout(() => {
        disconnectingRef.current = false;
        setActionError(null);
      }, 5000); // Increased from 2000 to 5000ms
    }
  }, [address, isConnected, isLinked, linkedWalletAddress, disconnect]);

  const handleConnect = () => {
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleLink = () => {
    if (!address) {
      setActionError('Please connect your wallet first');
      return;
    }
    setActionError(null);
    linkMutation.mutate(address);
  };

  const handleUnlink = () => {
    setActionError(null);
    unlinkMutation.mutate();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isProcessing = linkMutation.isPending || unlinkMutation.isPending;
  const isConnectingWallet = isConnecting || isPending || isReconnecting;

  const username = user?.email.split('@')[0] || 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Profile menu">
          <User className="h-4 w-4 mr-2" />
          {username}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user && (
          <DropdownMenuLabel>
            {user.email.split('@')[0]}
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />

        {/* Show linked wallet address and unlink option if wallet is linked */}
        {isLinked && linkedWalletAddress && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Linked wallet: {formatAddress(linkedWalletAddress)}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={handleUnlink}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <Unlink className="mr-2 h-4 w-4" />
                  Unlink wallet
                </>
              )}
            </DropdownMenuItem>
            {actionError && (
              <DropdownMenuLabel className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {actionError}
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Wallet connection section */}
        {!isConnected ? (
          <DropdownMenuItem
            onClick={handleConnect}
            disabled={isConnectingWallet || !injectedConnector}
          >
            {isConnectingWallet ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect wallet
              </>
            )}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Connected: {formatAddress(address)}
            </DropdownMenuLabel>
            {/* Show error if wallet mismatch (even when linked) */}
            {isLinked && linkedWalletAddress && address && 
             address.toLowerCase() !== linkedWalletAddress.toLowerCase() && 
             actionError && (
              <DropdownMenuLabel className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {actionError}
              </DropdownMenuLabel>
            )}
            <DropdownMenuItem
              onClick={handleDisconnect}
              disabled={isSwitching}
            >
              Disconnect
            </DropdownMenuItem>
            {!isLinked && (
              <DropdownMenuItem
                onClick={handleLink}
                disabled={isProcessing || !address}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Link connected wallet
                  </>
                )}
              </DropdownMenuItem>
            )}
            {actionError && !isLinked && (
              <DropdownMenuLabel className="text-xs text-destructive">
                {actionError}
              </DropdownMenuLabel>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

