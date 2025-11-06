/**
 * @file Transactions page
 * @notice Desktop-only transactions table displaying indexed blockchain transaction history
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactionsData, useCompanyStats } from '@/hooks/useApi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowUp, ArrowDown, Copy, Check } from 'lucide-react';
import { formatAddress, formatTokenAmount, formatDate } from '@/lib/utils';
import type { Transaction } from '@/types/api';

/**
 * Transactions page component
 * Displays all indexed blockchain transactions in a desktop-only table with sorting
 */
export function Transactions() {
  const navigate = useNavigate();
  
  // Fetch all transactions (with max limit of 100 for demo)
  const {
    transactions,
    isLoading,
    isError,
    error,
    refetch,
  } = useTransactionsData({ limit: 100 });
  
  // Fetch company stats for name, symbol, and decimals
  const { data: stats } = useCompanyStats();

  if (isLoading) {
    return <SkeletonTable />;
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              Could not load transactions
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

  const decimals = stats?.decimals ?? 18;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
        <CardTitle className="text-xl font-semibold">
          Transactions
          {stats?.name && ` • ${stats.name}`}
          {stats?.symbol && ` (${stats.symbol})`}
        </CardTitle>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable transactions={transactions} decimals={decimals} />
        </CardContent>
      </Card>
    </div>
  );
}

type SortField = 'txHash' | 'fromAddress' | 'toAddress' | 'amount' | 'blockNumber' | 'eventType' | 'blockTimestamp';
type SortDirection = 'asc' | 'desc';

/**
 * Transactions table component with client-side sorting
 */
function TransactionsTable({ transactions, decimals }: { transactions: Transaction[]; decimals: number }) {
  const [sortField, setSortField] = useState<SortField>('blockNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Sort transactions based on current sort field and direction
  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions];

    sorted.sort((a, b) => {
      let aValue: number | string | bigint;
      let bValue: number | string | bigint;

      switch (sortField) {
        case 'txHash':
          aValue = a.txHash.toLowerCase();
          bValue = b.txHash.toLowerCase();
          break;
        case 'fromAddress':
          aValue = (a.fromAddress || '').toLowerCase();
          bValue = (b.fromAddress || '').toLowerCase();
          break;
        case 'toAddress':
          aValue = (a.toAddress || '').toLowerCase();
          bValue = (b.toAddress || '').toLowerCase();
          break;
        case 'amount':
          aValue = BigInt(a.amount ?? 0);
          bValue = BigInt(b.amount ?? 0);
          break;
        case 'blockNumber':
          aValue = a.blockNumber ?? 0;
          bValue = b.blockNumber ?? 0;
          break;
        case 'eventType':
          aValue = a.eventType;
          bValue = b.eventType;
          break;
        case 'blockTimestamp':
          aValue = a.blockTimestamp ?? 0;
          bValue = b.blockTimestamp ?? 0;
          break;
        default:
          return 0;
      }

      // Compare values
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        const aNum: number =
          typeof aValue === 'bigint' ? Number(aValue) : (aValue as number);
        const bNum: number =
          typeof bValue === 'bigint' ? Number(bValue) : (bValue as number);
        comparison = aNum - bNum;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [transactions, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // Set new field with default descending direction
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (err) {
      console.error('Failed to copy hash:', err);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  if (transactions.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No transactions found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="border-b border-muted/40 text-muted-foreground">
          <tr>
            <th
              className="text-left py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('txHash')}
            >
              <div className="inline-flex items-center gap-1">
                Tx Hash
                <SortIcon field="txHash" />
              </div>
            </th>
            <th
              className="text-left py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('fromAddress')}
            >
              <div className="inline-flex items-center gap-1">
                From
                <SortIcon field="fromAddress" />
              </div>
            </th>
            <th
              className="text-left py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('toAddress')}
            >
              <div className="inline-flex items-center gap-1">
                To
                <SortIcon field="toAddress" />
              </div>
            </th>
            <th
              className="text-right py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('amount')}
            >
              <div className="inline-flex items-center gap-1 justify-end">
                Amount
                <SortIcon field="amount" />
              </div>
            </th>
            <th
              className="text-right py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('blockNumber')}
            >
              <div className="inline-flex items-center gap-1 justify-end">
                Block #
                <SortIcon field="blockNumber" />
              </div>
            </th>
            <th
              className="text-left py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('eventType')}
            >
              <div className="inline-flex items-center gap-1">
                Event Type
                <SortIcon field="eventType" />
              </div>
            </th>
            <th
              className="text-left py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('blockTimestamp')}
            >
              <div className="inline-flex items-center gap-1">
                Date
                <SortIcon field="blockTimestamp" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTransactions.map((tx, i) => {
            const amount = BigInt(tx.amount ?? 0);
            const isCopied = copiedHash === tx.txHash;
            const timestamp = tx.blockTimestamp
              ? new Date(tx.blockTimestamp * 1000).toISOString()
              : null;

            return (
              <tr
                key={`${tx.txHash}-${tx.logIndex}`}
                className={i % 2 === 0 ? 'bg-muted/20' : ''}
              >
                <td className="py-2 px-4 font-mono">
                  <div className="flex items-center gap-2">
                    <span>{formatAddress(tx.txHash, { size: 6 })}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleCopyHash(tx.txHash)}
                      title="Copy transaction hash"
                    >
                      {isCopied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </td>
                <td className="py-2 px-4 font-mono">
                  {tx.fromAddress ? formatAddress(tx.fromAddress) : '—'}
                </td>
                <td className="py-2 px-4 font-mono">
                  {tx.toAddress ? formatAddress(tx.toAddress) : '—'}
                </td>
                <td className="py-2 px-4 text-right font-mono">
                  {formatTokenAmount(amount, decimals, {
                    maxFraction: decimals,
                    compact: false,
                  })}
                </td>
                <td className="py-2 px-4 text-right text-muted-foreground font-mono">
                  {tx.blockNumber ?? '—'}
                </td>
                <td className="py-2 px-4">
                  <Badge
                    variant={tx.eventType === 'ISSUED' ? 'default' : 'secondary'}
                  >
                    {tx.eventType}
                  </Badge>
                </td>
                <td className="py-2 px-4 text-muted-foreground">
                  {timestamp ? formatDate(timestamp) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Loading skeleton component
 */
function SkeletonTable() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4 animate-pulse">
      <div className="h-10 bg-muted rounded-xl" />
      {[...Array(10)].map((_, i) => (
        <div key={i} className="h-6 bg-muted rounded-xl" />
      ))}
    </div>
  );
}

