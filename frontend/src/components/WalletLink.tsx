/**
 * @file Wallet Linking Component
 * @notice Component for linking and unlinking wallet addresses to user accounts
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Link2, Unlink } from 'lucide-react';
import { useWalletStatus } from '@/hooks/useApi';
import { linkWallet, unlinkWallet } from '@/lib/api';
import { formatAddress } from '@/lib/utils';

/**
 * WalletLink component
 * Allows users to link or unlink their connected wallet address to their account
 */
export function WalletLink() {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: walletStatus, isLoading, error } = useWalletStatus();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Link wallet mutation
  const linkMutation = useMutation({
    mutationFn: (walletAddress: string) => linkWallet(walletAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      setActionSuccess('Wallet linked successfully');
      setActionError(null);
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to link wallet');
      setActionSuccess(null);
    },
  });

  // Unlink wallet mutation
  const unlinkMutation = useMutation({
    mutationFn: () => unlinkWallet(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      setActionSuccess('Wallet unlinked successfully');
      setActionError(null);
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to unlink wallet');
      setActionSuccess(null);
    },
  });

  const handleLink = () => {
    if (!connectedAddress) {
      setActionError('Please connect your wallet first');
      return;
    }
    setActionError(null);
    linkMutation.mutate(connectedAddress);
  };

  const handleUnlink = () => {
    setActionError(null);
    unlinkMutation.mutate();
  };

  const isProcessing = linkMutation.isPending || unlinkMutation.isPending;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wallet Linking</CardTitle>
          <CardDescription>Loading wallet status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Checking wallet status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If there's an error loading status, default to "not linked" but still show UI
  const isLinked = walletStatus?.isLinked ?? false;
  
  // Show warning if status couldn't be loaded, but still allow actions
  const showStatusError = error && !walletStatus;
  const linkedAddress = walletStatus?.walletAddress;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Linking</CardTitle>
        <CardDescription>
          Link or unlink your wallet address to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Error Warning */}
        {showStatusError && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <p className="text-sm text-yellow-600">
              Could not load wallet status. You can still link or unlink your wallet.
            </p>
          </div>
        )}

        {/* Current Status */}
        <div className="p-3 bg-muted/50 border border-border rounded-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            <span
              className={`text-sm font-semibold ${
                isLinked ? 'text-green-600' : 'text-muted-foreground'
              }`}
            >
              {isLinked ? 'Linked' : 'Not Linked'}
            </span>
          </div>
          {linkedAddress && (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">Linked Address:</span>
              <code className="ml-2 text-xs font-mono">{formatAddress(linkedAddress)}</code>
            </div>
          )}
        </div>

        {/* Connected Wallet Info */}
        {isConnected && connectedAddress && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connected Wallet:</span>
              <code className="text-xs font-mono">{formatAddress(connectedAddress)}</code>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isLinked ? (
          <Button
            onClick={handleUnlink}
            disabled={isProcessing}
            variant="destructive"
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unlinking...
              </>
            ) : (
              <>
                <Unlink className="mr-2 h-4 w-4" />
                Unlink Wallet
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleLink}
            disabled={isProcessing || !isConnected || !connectedAddress}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Link Connected Wallet
              </>
            )}
          </Button>
        )}

        {!isConnected && (
          <p className="text-xs text-muted-foreground text-center">
            Connect your wallet first to link it to your account
          </p>
        )}

        {/* Success Message */}
        {actionSuccess && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">{actionSuccess}</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {actionError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{actionError}</span>
            </div>
          </div>
        )}

        {/* Info Message */}
        <div className="p-3 bg-muted/50 border border-border rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Linking a wallet associates it with your account in the
            database. This is separate from connecting your wallet via MetaMask. You can
            unlink the wallet at any time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

