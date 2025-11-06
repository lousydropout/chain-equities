/**
 * @file Share Issue Form Component
 * @notice Form for issuers to mint tokens to approved wallets
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits, isAddress } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { formatAddress } from '@/lib/utils';
import { useState } from 'react';

/**
 * Form validation schema
 */
const issueSchema = z.object({
  to: z.string().refine((val) => isAddress(val), {
    message: 'Invalid wallet address',
  }),
  amount: z
    .string()
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Amount must be a positive number'),
});

type IssueFormValues = z.infer<typeof issueSchema>;

/**
 * IssueSharesForm component props
 */
interface IssueSharesFormProps {
  tokenAddress: string;
  onSuccess?: () => void;
}

/**
 * IssueSharesForm component
 * Allows issuers to mint tokens to approved wallets
 */
export function IssueSharesForm({
  tokenAddress,
  onSuccess,
}: IssueSharesFormProps) {
  const { user } = useAuth();
  const { isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [copiedHash, setCopiedHash] = useState(false);

  const form = useForm({
    resolver: zodResolver(issueSchema),
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

  const onSubmit = async (data: IssueFormValues) => {
    try {
      const amountInWei = parseUnits(data.amount, 18);
      const recipientAddress = data.to as `0x${string}`;
      
      await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: chainEquityToken.abi,
        functionName: 'mint',
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

  // Check if user has issuer/admin role
  const canIssue =
    user?.role === 'issuer' || user?.role === 'admin';

  const isProcessing = isPending || confirming;
  const error = writeError || receiptError;

  if (!canIssue) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Issue Shares</CardTitle>
          <CardDescription>
            Only issuers and administrators can issue shares
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your role ({user?.role}) does not have permission to issue shares.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Issue Shares</CardTitle>
          <CardDescription>
            Connect your wallet to issue shares
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please connect your wallet to proceed. The connected wallet must be
            the contract owner (issuer).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue Shares</CardTitle>
        <CardDescription>
          Mint new tokens to an approved wallet address
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                    Amount will be converted to wei (18 decimals)
                  </p>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isPending ? 'Submitting...' : 'Confirming...'}
                </>
              ) : (
                'Issue Shares'
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
            <strong>Note:</strong> The recipient address must be approved (on the
            allowlist) before minting. The transaction will revert if the address
            is not approved.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

