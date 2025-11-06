/**
 * @file Approvals page
 * @notice Dashboard for issuer/admin users to approve investor wallets on the contract allowlist
 */

import { useNavigate } from 'react-router-dom';
import { usePendingApprovals, useApprovedUsers, useCompanyStats } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNetworkAutoSwitch } from '@/hooks/useNetworkAutoSwitch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Copy, AlertCircle } from 'lucide-react';
import { chainEquityToken } from '@/config/contracts';
import { formatAddress } from '@/lib/utils';

/**
 * Approvals page component
 * Displays pending wallet approvals and allows issuer/admin to approve them
 */
export function Approvals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected } = useAccount();
  const { isCorrectNetwork, isSwitching, switchError } = useNetworkAutoSwitch();
  const { data: stats } = useCompanyStats();
  const { data, isLoading, isError, error, refetch } = usePendingApprovals();
  const { data: approvedData, isLoading: isLoadingApproved } = useApprovedUsers();
  const queryClient = useQueryClient();

  const tokenAddress = stats?.tokenAddress;

  // Check if user has issuer/admin role
  const canApprove = user?.role === 'issuer' || user?.role === 'admin';

  if (!canApprove) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              Only issuers and administrators can approve wallets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              Your role ({user?.role}) does not have permission to approve wallets.
            </p>
            <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <SkeletonTable />;
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              Could not load pending approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              {error?.message || 'Please check your connection or try again.'}
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pending = data?.pending || [];
  const approved = approvedData?.approved || [];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
        <div className="text-right">
          <CardTitle className="text-xl font-semibold">
            Wallet Approval Management
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Approve pending investor wallets and manage approved users
          </p>
        </div>
      </div>

      {/* Pending Approvals Card */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Wallet Approvals</CardTitle>
          <CardDescription>
            Approve investor wallets to enable them to receive and transfer tokens.
            These investors have linked their wallets but need approval on the contract.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-sm text-yellow-600">
                Please connect your wallet to approve investors.
              </p>
            </div>
          )}

          {/* Network validation warning */}
          {isConnected && !isCorrectNetwork && !isSwitching && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">
                  Please switch to Localnet to interact with contracts
                  {switchError && `: ${switchError.message}`}
                </p>
              </div>
            </div>
          )}

          {!tokenAddress && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-sm text-yellow-600">
                Token address not available. Please check your configuration.
              </p>
            </div>
          )}

          {pending.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No pending approvals. All investors with linked wallets are approved.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Email</th>
                    <th className="text-left p-3 font-semibold">Display Name</th>
                    <th className="text-left p-3 font-semibold">Wallet Address</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((approval) => (
                    <ApprovalRow
                      key={approval.uid}
                      approval={approval}
                      tokenAddress={tokenAddress}
                      isConnected={isConnected}
                      isCorrectNetwork={isCorrectNetwork}
                      isSwitching={isSwitching}
                      queryClient={queryClient}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Users Card */}
      <Card>
        <CardHeader>
          <CardTitle>Approved Wallet Users</CardTitle>
          <CardDescription>
            Manage approved investor wallets. Revoking approval will prevent them from receiving or transferring tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-sm text-yellow-600">
                Please connect your wallet to revoke approvals.
              </p>
            </div>
          )}

          {/* Network validation warning */}
          {isConnected && !isCorrectNetwork && !isSwitching && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">
                  Please switch to Localnet to interact with contracts
                  {switchError && `: ${switchError.message}`}
                </p>
              </div>
            </div>
          )}

          {!tokenAddress && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-sm text-yellow-600">
                Token address not available. Please check your configuration.
              </p>
            </div>
          )}

          {isLoadingApproved ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading approved users...</p>
            </div>
          ) : approved.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No approved users. Approve wallets to see them here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Email</th>
                    <th className="text-left p-3 font-semibold">Display Name</th>
                    <th className="text-left p-3 font-semibold">Wallet Address</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approved.map((user) => (
                    <RevokeRow
                      key={user.uid}
                      user={user}
                      tokenAddress={tokenAddress}
                      isConnected={isConnected}
                      isCorrectNetwork={isCorrectNetwork}
                      isSwitching={isSwitching}
                      queryClient={queryClient}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Approval row component with approve button
 */
function ApprovalRow({
  approval,
  tokenAddress,
  isConnected,
  isCorrectNetwork,
  isSwitching,
  queryClient,
}: {
  approval: {
    uid: string;
    email: string;
    displayName: string;
    walletAddress: string;
    isApproved: boolean;
  };
  tokenAddress: string | null | undefined;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isSwitching: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const {
    data: txHash,
    writeContract,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: confirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Invalidate queries on success
  useEffect(() => {
    if (isSuccess && txHash) {
      queryClient.invalidateQueries({ queryKey: ['shareholders', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['shareholders', 'approved'] });
      queryClient.invalidateQueries({ queryKey: ['shareholders'] });
      queryClient.invalidateQueries({ queryKey: ['company-stats'] });
      
      // Reset after 3 seconds
      setTimeout(() => {
        resetWrite();
      }, 3000);
    }
  }, [isSuccess, txHash, queryClient, resetWrite]);

  const handleApprove = () => {
    if (!tokenAddress || !isConnected) {
      return;
    }

    try {
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: chainEquityToken.abi,
        functionName: 'approveWallet',
        args: [approval.walletAddress as `0x${string}`],
      });
    } catch (err) {
      console.error('Failed to write contract:', err);
    }
  };

  const handleCopyHash = async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch (err) {
      console.error('Failed to copy transaction hash:', err);
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(approval.walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy wallet address:', err);
    }
  };

  const isProcessing = isPending || confirming;
  const error = writeError || receiptError;
  const canApprove = isConnected && !!tokenAddress && !isProcessing && !isSuccess && isCorrectNetwork && !isSwitching;

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-3">{approval.email}</td>
      <td className="p-3">{approval.displayName}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{formatAddress(approval.walletAddress)}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyAddress}
            className="h-6 px-2"
            title="Copy full address"
          >
            <Copy className="h-3 w-3" />
            {copiedAddress && <span className="ml-1 text-xs">Copied!</span>}
          </Button>
        </div>
      </td>
      <td className="p-3 text-right">
        {isSuccess ? (
          <div className="flex items-center justify-end gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-600">Approved</span>
            {txHash && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyHash}
                className="h-6 px-2"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copiedHash ? 'Copied!' : 'Copy TX'}
              </Button>
            )}
          </div>
        ) : error ? (
          <div className="flex items-center justify-end gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">
              {error.message || 'Failed'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleApprove}
              disabled={!canApprove}
            >
              Retry
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleApprove}
            disabled={!canApprove}
            size="sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Approve'
            )}
          </Button>
        )}
      </td>
    </tr>
  );
}

/**
 * Revoke row component with revoke button
 */
function RevokeRow({
  user,
  tokenAddress,
  isConnected,
  isCorrectNetwork,
  isSwitching,
  queryClient,
}: {
  user: {
    uid: string;
    email: string;
    displayName: string;
    walletAddress: string;
    isApproved: boolean;
  };
  tokenAddress: string | null | undefined;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isSwitching: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const {
    data: txHash,
    writeContract,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: confirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Invalidate queries on success
  useEffect(() => {
    if (isSuccess && txHash) {
      queryClient.invalidateQueries({ queryKey: ['shareholders', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['shareholders', 'approved'] });
      queryClient.invalidateQueries({ queryKey: ['shareholders'] });
      queryClient.invalidateQueries({ queryKey: ['company-stats'] });
      
      // Reset after 3 seconds
      setTimeout(() => {
        resetWrite();
      }, 3000);
    }
  }, [isSuccess, txHash, queryClient, resetWrite]);

  const handleRevoke = () => {
    if (!tokenAddress || !isConnected) {
      return;
    }

    try {
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: chainEquityToken.abi,
        functionName: 'revokeWallet',
        args: [user.walletAddress as `0x${string}`],
      });
    } catch (err) {
      console.error('Failed to write contract:', err);
    }
  };

  const handleCopyHash = async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch (err) {
      console.error('Failed to copy transaction hash:', err);
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(user.walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy wallet address:', err);
    }
  };

  const isProcessing = isPending || confirming;
  const error = writeError || receiptError;
  const canRevoke = isConnected && !!tokenAddress && !isProcessing && !isSuccess && isCorrectNetwork && !isSwitching;

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-3">{user.email}</td>
      <td className="p-3">{user.displayName}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{formatAddress(user.walletAddress)}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyAddress}
            className="h-6 px-2"
            title="Copy full address"
          >
            <Copy className="h-3 w-3" />
            {copiedAddress && <span className="ml-1 text-xs">Copied!</span>}
          </Button>
        </div>
      </td>
      <td className="p-3 text-right">
        {isSuccess ? (
          <div className="flex items-center justify-end gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-600">Revoked</span>
            {txHash && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyHash}
                className="h-6 px-2"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copiedHash ? 'Copied!' : 'Copy TX'}
              </Button>
            )}
          </div>
        ) : error ? (
          <div className="flex items-center justify-end gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">
              {error.message || 'Failed'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevoke}
              disabled={!canRevoke}
            >
              Retry
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleRevoke}
            disabled={!canRevoke}
            size="sm"
            variant="destructive"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Revoke'
            )}
          </Button>
        )}
      </td>
    </tr>
  );
}

/**
 * Loading skeleton component
 */
function SkeletonTable() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4 animate-pulse">
      <div className="h-10 bg-muted rounded-xl" />
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3 mt-2" />
        </CardHeader>
        <CardContent>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-xl mb-2" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

