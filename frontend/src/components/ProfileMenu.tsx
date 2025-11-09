/**
 * @file Profile Menu Component
 * @notice Profile icon dropdown menu with wallet connection, linking, and logout functionality
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, LogOut, Link2, Unlink, Wallet, Loader2 } from 'lucide-react';
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

  const isLinked = walletStatus?.isLinked ?? false;
  const linkedWalletAddress = walletStatus?.walletAddress;
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
              <DropdownMenuLabel className="text-xs text-destructive">
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

