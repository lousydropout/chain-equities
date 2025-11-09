/**
 * @file Execute Split Form Component
 * @notice Form for admins/issuers to execute stock splits
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { parseEther } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { chainEquityToken } from '@/config/contracts';
import { useAccount } from 'wagmi';

/**
 * Form validation schema
 */
const splitSchema = z.object({
  multiplier: z.string().refine(
    val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    'Multiplier must be a positive number'
  ),
});

type SplitFormValues = z.infer<typeof splitSchema>;

/**
 * ExecuteSplitForm component props
 */
interface ExecuteSplitFormProps {
  tokenAddress: string;
  onSuccess?: () => void;
}

/**
 * ExecuteSplitForm component
 * Allows admins/issuers to execute stock splits
 */
export function ExecuteSplitForm({
  tokenAddress,
  onSuccess,
}: ExecuteSplitFormProps) {
  const { isConnected } = useAccount();
  const { isCorrectNetwork, isSwitching, switchError } = useNetworkAutoSwitch();
  const queryClient = useQueryClient();
  const [copiedHash, setCopiedHash] = useState(false);

  // Read current split factor
  const { data: currentSplitFactor } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: chainEquityToken.abi,
    functionName: 'splitFactor',
    query: {
      enabled: !!tokenAddress && isConnected,
    },
  });

  const form = useForm({
    resolver: zodResolver(splitSchema),
    defaultValues: {
      multiplier: '',
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
      queryClient.invalidateQueries({ queryKey: ['company', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['shareholders'] });
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [isSuccess, txHash, queryClient, onSuccess]);

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      form.reset();
      setTimeout(() => {
        resetWrite();
      }, 3000);
    }
  }, [isSuccess, form, resetWrite]);

  const onSubmit = async (data: SplitFormValues) => {
    try {
      // Convert multiplier to 1e18 precision (e.g., 7 -> 7e18)
      const multiplierInWei = parseEther(data.multiplier);

      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: chainEquityToken.abi,
        functionName: 'executeSplit',
        args: [multiplierInWei],
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

  /**
   * Recursively extract error messages from nested error structures
   */
  const extractErrorMessages = (
    error: unknown,
    visited = new Set(),
  ): string[] => {
    if (!error || visited.has(error)) return [];
    visited.add(error);

    const messages: string[] = [];
    if (error instanceof Error) {
      if (error.message) messages.push(error.message);
      if (error.cause) {
        messages.push(...extractErrorMessages(error.cause, visited));
      }
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      if (err.message) {
        messages.push(...extractErrorMessages(err.message, visited));
      }
      if (err.data) {
        messages.push(...extractErrorMessages(err.data, visited));
      }
      if (err.cause) {
        messages.push(...extractErrorMessages(err.cause, visited));
      }
    }

    return messages;
  };

  const errorMessages = writeError
    ? extractErrorMessages(writeError)
    : receiptError
      ? extractErrorMessages(receiptError)
      : switchError
        ? extractErrorMessages(switchError)
        : [];

  const displayError = errorMessages[0] || null;

  // Calculate current split factor as a readable number
  const currentFactor =
    currentSplitFactor !== undefined &&
    typeof currentSplitFactor === 'bigint' &&
    currentSplitFactor > 0n
      ? Number(currentSplitFactor) / 1e18
      : 1;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Execute Stock Split
          </CardTitle>
          <CardDescription>
            Execute a stock split to adjust share prices (e.g., 7-for-1 split)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please connect your wallet to execute a stock split.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isCorrectNetwork && !isSwitching) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Execute Stock Split
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              Please switch to the localnet network to execute splits.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Execute Stock Split
        </CardTitle>
        <CardDescription>
          Execute a stock split to adjust share prices. This is a virtual split
          that doesn't modify actual balances but adjusts the effective balance
          multiplier.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentSplitFactor !== undefined &&
          typeof currentSplitFactor === 'bigint' && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Current Split Factor</p>
              <p className="text-2xl font-bold">{currentFactor}x</p>
              <p className="text-xs text-muted-foreground mt-1">
                All effective balances are multiplied by this factor
              </p>
            </div>
          )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="multiplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Split Multiplier</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="7"
                      disabled={isPending || confirming || isSwitching}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the split multiplier (e.g., 7 for a 7-for-1 split, 2
                    for a 2-for-1 split). Must be greater than 0.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {displayError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-destructive font-medium">
                      Transaction Failed
                    </p>
                    <p className="text-xs text-destructive/80 mt-1">
                      {displayError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isSuccess && txHash && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-md">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-green-900 dark:text-green-100 font-medium">
                      Split Executed Successfully
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-background px-2 py-1 rounded">
                        {txHash.slice(0, 10)}...{txHash.slice(-8)}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyHash}
                        className="h-6 px-2"
                      >
                        {copiedHash ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || confirming || isSwitching}
            >
              {isPending || confirming || isSwitching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isPending
                    ? 'Confirm in wallet...'
                    : confirming
                      ? 'Confirming...'
                      : 'Switching network...'}
                </>
              ) : (
                'Execute Split'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

