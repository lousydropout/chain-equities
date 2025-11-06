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
import { ArrowLeft } from 'lucide-react';
import { ShareholderTable } from '@/components/ShareholderTable';

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
  const totalOutstanding = totalEffectiveSupply
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
          <ShareholderTable
            shareholders={shareholders}
            totalOutstanding={totalOutstanding}
            decimals={decimals}
            defaultSort="ownership"
          />
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

