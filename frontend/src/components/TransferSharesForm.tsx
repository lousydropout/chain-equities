/**
 * @file Share Transfer Form Component
 * @notice Form for shareholders to transfer tokens to approved addresses
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits, isAddress } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
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
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { chainEquityToken } from '@/config/contracts';
import { useShareholder } from '@/hooks/useApi';
import { formatAddress, formatTokenAmount } from '@/lib/utils';
import { useState } from 'react';

/**
 * Form validation schema
 */
const createTransferSchema = (userBalance: string | null) => {
  return z.object({
    to: z.string().refine((val) => isAddress(val), {
      message: 'Invalid wallet address',
    }),
    amount: z
      .string()
      .refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Amount must be a positive number')
      .refine(
        (val) => {
          if (!userBalance) return true; // Skip validation if balance not loaded yet
          try {
            const amountInWei = parseUnits(val, 18);
            const balance = BigInt(userBalance);
            return amountInWei <= balance;
          } catch {
            return false;
          }
        },
        (val) => ({
          message: `Amount exceeds your balance of ${userBalance ? formatTokenAmount(userBalance, 18) : '0'}`,
        })
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
  const queryClient = useQueryClient();
  const [copiedHash, setCopiedHash] = useState(false);

  // Fetch user's balance
  const {
    data: shareholderData,
    isLoading: balanceLoading,
    error: balanceError,
  } = useShareholder(connectedAddress, isConnected);

  const userBalance = shareholderData?.balance ?? null;

  // Create schema with user balance for validation
  const transferSchema = useMemo(
    () => createTransferSchema(userBalance),
    [userBalance]
  );

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      to: '',
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
      queryClient.invalidateQueries({ queryKey: ['company-stats'] });
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
      const recipientAddress = data.to as `0x${string}`;

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

  const isProcessing = isPending || confirming;
  const error = writeError || receiptError;

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
            Your connected wallet ({connectedAddress && formatAddress(connectedAddress)}) does
            not hold any shares. You need shares to transfer them to other addresses.
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
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x..."
                      disabled={isProcessing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                  <p className="text-xs text-muted-foreground">
                    Amount will be converted to wei ({decimals} decimals)
                  </p>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isProcessing || !hasBalance}
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
              <span className="text-sm font-medium">
                Transaction confirmed
              </span>
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
            <p className="text-xs text-destructive mt-1">
              {error.message || 'An error occurred while processing the transaction'}
            </p>
          </div>
        )}

        {/* Info Message */}
        <div className="mt-4 p-3 bg-muted/50 border border-border rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Both your address and the recipient address must be
            approved (on the allowlist) if transfer restrictions are enabled. The
            transaction will revert if either address is not approved.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

