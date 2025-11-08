/**
 * @file Share Transfer Form Component
 * @notice Form for shareholders to transfer tokens to approved addresses
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi';
import { parseUnits } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useNetworkAutoSwitch } from '@/hooks/useNetworkAutoSwitch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { chainEquityToken } from '@/config/contracts';
import { useMyShareholder } from '@/hooks/useApi';
import { formatAddress, formatTokenAmount } from '@/lib/utils';
import { useState } from 'react';
import { useInvestorsWithWallets } from '@/hooks/useApi';

/**
 * Form validation schema
 */
const createTransferSchema = (userBalance: string | null) => {
  return z.object({
    recipientAddress: z.string().min(1, 'Please select a recipient'),
    amount: z
      .string()
      .refine(val => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Amount must be a positive number')
      .refine(
        val => {
          if (!userBalance) return true; // Skip validation if balance not loaded yet
          try {
            const amountInWei = parseUnits(val, 18);
            const balance = BigInt(userBalance);
            return amountInWei <= balance;
          } catch {
            return false;
          }
        },
        val => ({
          message: `Amount exceeds your balance of ${userBalance ? formatTokenAmount(userBalance, 18) : '0'}`,
        }),
      ),
  });
};

type TransferFormValues = z.infer<ReturnType<typeof createTransferSchema>>;

/**
 * TransferSharesForm component props
 */
interface TransferSharesFormProps {
  tokenAddress: string;
  decimals?: number;
  onSuccess?: () => void;
}

/**
 * TransferSharesForm component
 * Allows shareholders to transfer tokens to approved addresses
 */
export function TransferSharesForm({
  tokenAddress,
  decimals = 18,
  onSuccess,
}: TransferSharesFormProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const { isCorrectNetwork, isSwitching, switchError } = useNetworkAutoSwitch();
  const queryClient = useQueryClient();
  const [copiedHash, setCopiedHash] = useState(false);

  // Query by user ID (foundational), not wallet address
  // Backend will look up the linked wallet address from the authenticated user
  const {
    data: shareholderData,
    isLoading: balanceLoading,
    error: balanceError,
  } = useMyShareholder();

  // Get investors with wallets - these are users with approved wallets
  const { data: investorsData, isLoading: investorsLoading } =
    useInvestorsWithWallets();
  const investors = investorsData?.investors || [];

  // Show ALL investors with linked wallets (approved), not just shareholders
  // Recipients don't need balances to receive tokens - they just need approved wallets
  // Exclude the current user's address
  const availableRecipients = useMemo(() => {
    if (!shareholderData?.address) return [];

    const currentUserAddress = shareholderData.address.toLowerCase();

    // Return all investors with linked wallets, excluding current user
    return investors
      .filter(investor => {
        if (!investor.walletAddress) return false;
        const address = investor.walletAddress.toLowerCase();
        return address !== currentUserAddress;
      })
      .map(investor => ({
        address: investor.walletAddress!,
        displayName: investor.displayName || investor.email,
        email: investor.email,
        uid: investor.uid,
      }));
  }, [investors, shareholderData?.address]);

  // Handle 404 gracefully - it means wallet not linked or no balance
  const userBalance =
    balanceError?.status === 404 ? null : (shareholderData?.balance ?? null);

  // Check if connected wallet matches linked wallet (for security)
  const walletMismatch =
    connectedAddress &&
    shareholderData?.address &&
    connectedAddress.toLowerCase() !== shareholderData.address.toLowerCase();

  // Create schema with user balance for validation
  const transferSchema = useMemo(
    () => createTransferSchema(userBalance),
    [userBalance],
  );

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      recipientAddress: '',
      amount: '',
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ['shareholders'] });
      queryClient.invalidateQueries({ queryKey: ['shareholder', 'me'] }); // Refresh user's balance
      queryClient.invalidateQueries({ queryKey: ['company', 'stats'] }); // Fix query key format
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [isSuccess, txHash, queryClient, onSuccess]);

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      form.reset();
      // Reset after a delay to allow user to see success message
      setTimeout(() => {
        resetWrite();
      }, 3000);
    }
  }, [isSuccess, form, resetWrite]);

  // Revalidate form when balance changes
  useEffect(() => {
    if (userBalance !== null) {
      form.trigger('amount');
    }
  }, [userBalance, form]);

  const onSubmit = async (data: TransferFormValues) => {
    if (!connectedAddress) {
      return;
    }

    try {
      const amountInWei = parseUnits(data.amount, decimals);
      const recipientAddress = data.recipientAddress as `0x${string}`;

      await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: chainEquityToken.abi,
        functionName: 'transfer',
        args: [recipientAddress, amountInWei],
      });
    } catch (err) {
      // Error is handled by writeError state
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

  /**
   * Recursively extract error messages from nested error structures
   * Viem/Wagmi errors can be deeply nested: error.data.data.message, error.cause.message, etc.
   */
  const extractErrorMessages = (
    error: unknown,
    visited = new Set(),
  ): string[] => {
    if (!error || visited.has(error)) return [];
    visited.add(error);

    const messages: string[] = [];

    if (typeof error === 'string') {
      messages.push(error);
      return messages;
    }

    if (error instanceof Error) {
      messages.push(error.message);
      if (error.cause) {
        messages.push(...extractErrorMessages(error.cause, visited));
      }
    }

    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;

      // Check common error properties
      if (errorObj.message && typeof errorObj.message === 'string') {
        messages.push(errorObj.message);
      }
      if (errorObj.reason && typeof errorObj.reason === 'string') {
        messages.push(errorObj.reason);
      }
      if (errorObj.shortMessage && typeof errorObj.shortMessage === 'string') {
        messages.push(errorObj.shortMessage);
      }

      // Recursively check nested structures
      if (errorObj.data) {
        messages.push(...extractErrorMessages(errorObj.data, visited));
      }
      if (errorObj.cause) {
        messages.push(...extractErrorMessages(errorObj.cause, visited));
      }
      if (errorObj.error) {
        messages.push(...extractErrorMessages(errorObj.error, visited));
      }
    }

    return messages;
  };

  /**
   * Parse contract error to extract user-friendly message
   * Safely handles BigInt values and nested error objects
   */
  const parseContractError = (error: unknown): string => {
    if (!error) return 'An error occurred while processing the transaction';

    // Extract all error messages from nested structure
    const allMessages = extractErrorMessages(error);
    const combinedMessage = allMessages.join(' ');

    // Check for approval-related errors
    if (
      combinedMessage.includes('sender not approved') ||
      combinedMessage.includes('ChainEquityToken: sender not approved')
    ) {
      return 'Your wallet address is not approved for transfers. Please contact an administrator to approve your wallet.';
    }

    if (
      combinedMessage.includes('recipient not approved') ||
      combinedMessage.includes('ChainEquityToken: recipient not approved')
    ) {
      return 'The recipient wallet address is not approved for transfers. The recipient must be approved by an administrator before they can receive shares.';
    }

    // Check for other common contract errors
    if (combinedMessage.includes('exceeds authorized supply')) {
      return 'The transfer amount exceeds the authorized supply limit.';
    }

    if (combinedMessage.includes('cannot transfer to zero address')) {
      return 'Cannot transfer to an invalid address.';
    }

    // Extract revert reason from "execution reverted: ..." pattern
    const revertMatch = combinedMessage.match(
      /execution reverted(?::\s*(.+?))?(?:\s|$)/i,
    );
    if (revertMatch) {
      const reason = revertMatch[1]?.trim();
      if (reason) {
        if (reason.includes('not approved')) {
          if (reason.includes('sender')) {
            return 'Your wallet address is not approved for transfers. Please contact an administrator to approve your wallet.';
          }
          if (reason.includes('recipient')) {
            return 'The recipient wallet address is not approved for transfers. The recipient must be approved by an administrator before they can receive shares.';
          }
        }
        return `Transaction failed: ${reason}`;
      }
      return 'Transaction was rejected by the contract. This may be due to insufficient balance, approval requirements, or other restrictions.';
    }

    // Check for generic revert patterns
    if (
      combinedMessage.includes('reverted') ||
      combinedMessage.includes('revert')
    ) {
      // Try to extract reason from various patterns
      const reasonPatterns = [
        /reason:\s*(.+?)(?:\n|$)/i,
        /reverted with reason:\s*(.+?)(?:\n|$)/i,
        /reverted:\s*(.+?)(?:\n|$)/i,
      ];

      for (const pattern of reasonPatterns) {
        const match = combinedMessage.match(pattern);
        if (match && match[1]) {
          const reason = match[1].trim();
          if (reason.includes('not approved')) {
            if (reason.includes('sender')) {
              return 'Your wallet address is not approved for transfers. Please contact an administrator to approve your wallet.';
            }
            if (reason.includes('recipient')) {
              return 'The recipient wallet address is not approved for transfers. The recipient must be approved by an administrator before they can receive shares.';
            }
          }
          return `Transaction failed: ${reason}`;
        }
      }

      return 'Transaction was rejected by the contract. This may be due to insufficient balance, approval requirements, or other restrictions.';
    }

    // If we have "Internal JSON-RPC error", try to find the actual error in nested structure
    if (combinedMessage.includes('Internal JSON-RPC error')) {
      // Look for the actual revert reason in the nested messages
      const actualError = allMessages.find(
        msg =>
          msg.includes('reverted') ||
          msg.includes('not approved') ||
          msg.includes('execution reverted'),
      );

      if (actualError) {
        // Recursively parse the actual error
        return parseContractError(actualError);
      }

      return 'Transaction failed. The recipient wallet may not be approved for transfers, or there may be other restrictions. Please verify the recipient is approved.';
    }

    // Return the most specific error message (usually the deepest one)
    const specificMessage =
      allMessages.find(
        msg =>
          msg.length > 0 &&
          !msg.includes('Internal JSON-RPC error') &&
          !msg.includes('RPC Error'),
      ) ||
      allMessages[0] ||
      'An error occurred while processing the transaction';

    return specificMessage;
  };

  const isProcessing = isPending || confirming;
  const error = writeError || receiptError;
  const userFriendlyError = error ? parseContractError(error) : null;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Shares</CardTitle>
          <CardDescription>
            Connect your wallet to transfer shares
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please connect your wallet to proceed. You can only transfer shares
            from your connected wallet address.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show message if wallet is not linked
  if (!balanceLoading && balanceError?.status === 404) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Shares</CardTitle>
          <CardDescription>Wallet Not Linked</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please link your wallet to your account first. You can link your
            wallet using the wallet linking section above.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show warning if connected wallet doesn't match linked wallet
  if (walletMismatch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Shares</CardTitle>
          <CardDescription>Wallet Mismatch</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            Your connected wallet ({formatAddress(connectedAddress)}) does not
            match your linked wallet ({formatAddress(shareholderData?.address)}
            ).
          </p>
          <p className="text-sm text-muted-foreground">
            Please connect the wallet linked to your account (
            {formatAddress(shareholderData?.address)}) to transfer shares.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while fetching balance
  if (balanceLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Shares</CardTitle>
          <CardDescription>Loading your balance...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Fetching your share balance...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if user has any balance
  const hasBalance = userBalance && BigInt(userBalance) > 0n;

  if (!hasBalance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Shares</CardTitle>
          <CardDescription>
            You don't have any shares to transfer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your connected wallet (
            {connectedAddress && formatAddress(connectedAddress)}) does not hold
            any shares. You need shares to transfer them to other addresses.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Shares</CardTitle>
        <CardDescription>
          Transfer tokens to an approved wallet address
        </CardDescription>
      </CardHeader>
      <CardContent>
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

        {/* Balance Display */}
        <div className="mb-4 p-3 bg-muted/50 border border-border rounded-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Your Balance:</span>
            <span className="text-sm font-mono">
              {userBalance ? formatTokenAmount(userBalance, decimals) : '—'}
            </span>
          </div>
          {connectedAddress && (
            <p className="text-xs text-muted-foreground mt-1">
              From: {formatAddress(connectedAddress)}
            </p>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isProcessing || investorsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a recipient" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRecipients.length === 0 ? (
                        <SelectItem value="none" disabled>
                          {investorsLoading
                            ? 'Loading recipients...'
                            : 'No recipients with approved wallets available'}
                        </SelectItem>
                      ) : (
                        availableRecipients.map(recipient => (
                          <SelectItem
                            key={recipient.address}
                            value={recipient.address}
                          >
                            {recipient.displayName} (
                            {formatAddress(recipient.address)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {availableRecipients.length === 0 && !investorsLoading && (
                    <p className="text-xs text-muted-foreground">
                      No other users with approved wallets are available to
                      receive transfers.
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="1000"
                      disabled={isProcessing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={
                isProcessing || !hasBalance || isSwitching || !isCorrectNetwork
              }
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isPending ? 'Submitting...' : 'Confirming...'}
                </>
              ) : (
                'Transfer Shares'
              )}
            </Button>
          </form>
        </Form>

        {/* Success Message */}
        {isSuccess && txHash && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Transaction confirmed</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs font-mono text-muted-foreground">
                {formatAddress(txHash, { size: 6 })}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyHash}
                className="h-6 px-2"
              >
                <Copy className="h-3 w-3" />
                {copiedHash ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Transaction failed</span>
            </div>
            <p className="text-sm text-destructive mt-2">{userFriendlyError}</p>
            {userFriendlyError?.includes('not approved') && (
              <p className="text-xs text-destructive/80 mt-2">
                Tip: Check the Approvals page to see which wallets need
                approval.
              </p>
            )}
          </div>
        )}

        {/* Info Message */}
        <div className="mt-4 p-3 bg-muted/50 border border-border rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Both your address and the recipient address
            must be approved (on the allowlist) if transfer restrictions are
            enabled. The transaction will revert if either address is not
            approved.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
