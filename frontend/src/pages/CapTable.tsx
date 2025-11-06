/**
 * @file Cap Table page
 * @notice Desktop-only cap table displaying all shareholders with holdings
 */

import { useNavigate } from 'react-router-dom';
import { useShareholdersData, useCompanyStats } from '@/hooks/useApi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info } from 'lucide-react';
import { formatAddress, formatTokenAmount } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Cap Table page component
 * Displays all shareholders in a desktop-only table with holdings, effective balances, and ownership percentages
 */
export function CapTable() {
  const navigate = useNavigate();
  
  // Fetch all shareholders (with max limit of 100 for demo)
  const {
    shareholders,
    isLoading,
    isError,
    error,
    refetch,
    totalEffectiveSupply,
  } = useShareholdersData({ limit: 100 });
  
  // Fetch company stats for name, symbol, and total outstanding
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
              Could not load shareholders
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
  const totalEffective = totalEffectiveSupply
    ? BigInt(totalEffectiveSupply)
    : stats?.totalOutstanding
      ? BigInt(stats.totalOutstanding)
      : 1n;

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
          Cap Table
          {stats?.name && ` • ${stats.name}`}
          {stats?.symbol && ` (${stats.symbol})`}
        </CardTitle>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Shareholders</CardTitle>
        </CardHeader>
        <CardContent>
          {shareholders.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No shareholders found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="border-b border-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left py-2 px-4">Address</th>
                    <th className="text-right py-2 px-4">Balance</th>
                    <th className="text-right py-2 px-4">
                      <div className="inline-flex items-center gap-1">
                        Effective Balance
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                Balance adjusted for share splits (multiplied by
                                split factor)
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </th>
                    <th className="text-right py-2 px-4">Ownership %</th>
                    <th className="text-right py-2 px-4">Last Block</th>
                  </tr>
                </thead>
                <tbody>
                  {shareholders.map((shareholder, i) => {
                    const balance = BigInt(shareholder.balance ?? 0);
                    const effectiveBalance = BigInt(
                      shareholder.effectiveBalance ?? shareholder.balance ?? 0
                    );
                    // Use ownership percentage from API, or calculate it
                    const ownershipPct =
                      shareholder.ownershipPercentage ??
                      (totalEffective > 0n
                        ? (Number(effectiveBalance) /
                            Number(totalEffective)) *
                          100
                        : 0);

                    return (
                      <tr
                        key={shareholder.address ?? i}
                        className={
                          i % 2 === 0 ? 'bg-muted/20' : ''
                        }
                      >
                        <td className="py-2 px-4 font-mono">
                          {formatAddress(shareholder.address)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono">
                          {formatTokenAmount(balance, decimals)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono">
                          {formatTokenAmount(effectiveBalance, decimals)}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {ownershipPct.toFixed(2)}%
                        </td>
                        <td className="py-2 px-4 text-right text-muted-foreground font-mono">
                          {shareholder.lastUpdatedBlock ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
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

