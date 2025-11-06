/**
 * @file Share Issue Form Component
 * @notice Form for issuers to mint tokens to approved wallets
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi';
import { parseUnits, isAddress } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useInvestorsWithWallets } from '@/hooks/useApi';
import { formatAddress } from '@/lib/utils';
import { useState } from 'react';

/**
 * Form validation schema
 */
const issueSchema = z.object({
  investorUid: z.string().min(1, 'Please select an investor'),
  amount: z.string().refine(val => {
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
  const { isCorrectNetwork, isSwitching, switchError } = useNetworkAutoSwitch();
  const queryClient = useQueryClient();
  const [copiedHash, setCopiedHash] = useState(false);

  // Fetch investors with linked wallets
  const { data: investorsData, isLoading: investorsLoading } =
    useInvestorsWithWallets();
  const investors = investorsData?.investors || [];

  const form = useForm({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      investorUid: '',
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
      queryClient.invalidateQueries({ queryKey: ['company', 'stats'] });
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
      // Find the selected investor's wallet address
      const selectedInvestor = investors.find(
        inv => inv.uid === data.investorUid,
      );
      if (!selectedInvestor || !selectedInvestor.walletAddress) {
        throw new Error('Selected investor does not have a linked wallet');
      }

      const amountInWei = parseUnits(data.amount, 18);
      const recipientAddress = selectedInvestor.walletAddress as `0x${string}`;

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
      combinedMessage.includes('recipient not approved') ||
      combinedMessage.includes('ChainEquityToken: recipient not approved')
    ) {
      return 'The recipient wallet address is not approved. Please approve the recipient wallet on the Approvals page before issuing shares.';
    }

    // Check for other common contract errors
    if (combinedMessage.includes('exceeds authorized supply')) {
      return 'The issuance amount exceeds the authorized supply limit.';
    }

    if (combinedMessage.includes('cannot mint to zero address')) {
      return 'Cannot issue shares to an invalid address.';
    }

    // Extract revert reason from "execution reverted: ..." pattern
    const revertMatch = combinedMessage.match(
      /execution reverted(?::\s*(.+?))?(?:\s|$)/i,
    );
    if (revertMatch) {
      const reason = revertMatch[1]?.trim();
      if (reason) {
        if (reason.includes('not approved')) {
          if (reason.includes('recipient')) {
            return 'The recipient wallet address is not approved. Please approve the recipient wallet on the Approvals page before issuing shares.';
          }
        }
        return `Transaction failed: ${reason}`;
      }
      return 'Transaction was rejected by the contract. This may be due to approval requirements or other restrictions.';
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
            if (reason.includes('recipient')) {
              return 'The recipient wallet address is not approved. Please approve the recipient wallet on the Approvals page before issuing shares.';
            }
          }
          return `Transaction failed: ${reason}`;
        }
      }

      return 'Transaction was rejected by the contract. This may be due to approval requirements or other restrictions.';
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

      return 'Transaction failed. The recipient wallet may not be approved, or there may be other restrictions. Please verify the recipient is approved.';
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

  // Check if user has issuer/admin role
  const canIssue = user?.role === 'issuer' || user?.role === 'admin';

  const isProcessing = isPending || confirming;
  const error = writeError || receiptError;
  const userFriendlyError = error ? parseContractError(error) : null;

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
          <CardDescription>Connect your wallet to issue shares</CardDescription>
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="investorUid"
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
                        <SelectValue placeholder="Select an investor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {investors.length === 0 ? (
                        <SelectItem value="none" disabled>
                          {investorsLoading
                            ? 'Loading investors...'
                            : 'No investors with linked wallets'}
                        </SelectItem>
                      ) : (
                        investors.map(investor => (
                          <SelectItem key={investor.uid} value={investor.uid}>
                            {investor.displayName} (
                            {formatAddress(investor.walletAddress)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {investors.length === 0 && !investorsLoading && (
                    <p className="text-xs text-muted-foreground">
                      Investors must link their wallets before you can issue
                      shares to them.
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
              disabled={isProcessing || isSwitching || !isCorrectNetwork}
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
                Tip: Go to the Approvals page to approve the recipient wallet.
              </p>
            )}
          </div>
        )}

        {/* Info Message */}
        <div className="mt-4 p-3 bg-muted/50 border border-border rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> The recipient address must be approved (on
            the allowlist) before minting. The transaction will revert if the
            address is not approved.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
