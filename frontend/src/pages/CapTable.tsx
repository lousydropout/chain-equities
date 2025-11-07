/**
 * @file Cap Table page
 * @notice Desktop-only cap table displaying all shareholders with holdings
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShareholdersData, useCompanyStats, useBlocksWithTransactions } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { ShareholderTable } from '@/components/ShareholderTable';

/**
 * Cap Table page component
 * Displays all shareholders in a desktop-only table with holdings, effective balances, and ownership percentages
 */
export function CapTable() {
  const navigate = useNavigate();
  const [blockNumber, setBlockNumber] = useState<number | null>(null);

  // Fetch list of blocks with transactions for navigation
  const { data: blocksData } = useBlocksWithTransactions();
  const blocks = blocksData?.blocks ?? [];

  // Fetch all shareholders (with max limit of 100 for demo)
  const {
    shareholders,
    isLoading,
    isError,
    error,
    refetch,
    totalEffectiveSupply,
    blockNumber: responseBlockNumber,
  } = useShareholdersData({
    limit: 100,
    blockNumber: blockNumber ?? undefined,
  });

  // Fetch company stats for name, symbol, and total outstanding
  const { data: stats } = useCompanyStats();

  // Navigation helpers - currentBlock is guaranteed to be defined here due to loading check
  // TypeScript doesn't narrow through early return, so we use non-null assertion
  const currentBlock = responseBlockNumber!;
  const previousBlock = useMemo(() => {
    if (blocks.length === 0) return null;
    // Find the largest block that is less than currentBlock
    const idx = blocks.findIndex((b) => b >= currentBlock);
    if (idx <= 0) return null;
    return blocks[idx - 1];
  }, [currentBlock, blocks]);

  const nextBlock = useMemo(() => {
    if (blocks.length === 0) return null;
    // Find the smallest block that is greater than currentBlock
    const idx = blocks.findIndex((b) => b > currentBlock);
    if (idx === -1) return null;
    return blocks[idx];
  }, [currentBlock, blocks]);

  const handlePreviousBlock = () => {
    if (previousBlock !== null) {
      setBlockNumber(previousBlock);
    }
  };

  const handleNextBlock = () => {
    if (nextBlock !== null) {
      setBlockNumber(nextBlock);
    }
  };

  const handleLatest = () => {
    setBlockNumber(null);
  };

  if (isLoading || !responseBlockNumber) {
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

      {/* Shareholders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Shareholders</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Block {currentBlock}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handlePreviousBlock}
                  disabled={previousBlock === null}
                  title="Previous block with transactions"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleNextBlock}
                  disabled={nextBlock === null}
                  title="Next block with transactions"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLatest}
                  disabled={blockNumber === null}
                >
                  Latest
                </Button>
              </div>
            </div>
          </div>
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
