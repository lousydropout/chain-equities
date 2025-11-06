/**
 * @file Cap Table page
 * @notice Desktop-only cap table displaying all shareholders with holdings
 * Supports historical snapshots by block number
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShareholdersData, useCompanyStats } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { ShareholderTable } from '@/components/ShareholderTable';

/**
 * Cap Table page component
 * Displays all shareholders in a desktop-only table with holdings, effective balances, and ownership percentages
 * Supports historical snapshots by block number
 */
export function CapTable() {
  const navigate = useNavigate();
  const [blockNumber, setBlockNumber] = useState<number | undefined>(undefined);
  const [inputValue, setInputValue] = useState<string>('');

  // Fetch all shareholders (with max limit of 100 for demo)
  const {
    shareholders,
    isLoading,
    isError,
    error,
    refetch,
    totalEffectiveSupply,
    blockNumber: currentBlockNumber,
    latestBlock,
    firstBlock,
    transactionBlocks,
    warning,
  } = useShareholdersData({
    limit: 100,
    blockNumber: blockNumber,
  });

  // Fetch company stats for name, symbol, and total outstanding
  const { data: stats } = useCompanyStats();

  // Sync input value when blockNumber state changes programmatically
  useEffect(() => {
    if (blockNumber !== undefined) {
      setInputValue(blockNumber.toString());
    } else if (!inputValue) {
      // Only clear if input is already empty
      setInputValue('');
    }
  }, [blockNumber]);

  // Sync input with API response when it differs (handles clamping)
  useEffect(() => {
    if (currentBlockNumber !== undefined) {
      const currentInput = parseInt(inputValue, 10);
      // Only update if the API returned a different value (was clamped) or input is empty
      if (
        inputValue === '' ||
        (currentInput !== currentBlockNumber && currentInput !== blockNumber)
      ) {
        setInputValue(currentBlockNumber.toString());
      }
    }
  }, [currentBlockNumber]);

  // Determine if we're viewing historical snapshot
  const isHistoricalView = currentBlockNumber !== undefined;

  // Navigation handlers - navigate through transactionBlocks array
  // Find the next/previous block in the sorted array of transaction blocks
  const getPrevBlock = (): number | null => {
    if (transactionBlocks.length === 0) return null;

    if (isHistoricalView && currentBlockNumber !== undefined) {
      // Find the index of current block in transaction blocks
      const currentIndex = transactionBlocks.indexOf(currentBlockNumber);

      if (currentIndex > 0) {
        // We're at a block in the list, go to previous one
        return transactionBlocks[currentIndex - 1];
      } else if (currentIndex === 0) {
        // We're at the first transaction block, no previous
        return null;
      } else {
        // Current block not in list (might be clamped), find the largest block < currentBlockNumber
        const prevBlocks = transactionBlocks.filter(
          b => b < currentBlockNumber,
        );
        return prevBlocks.length > 0 ? prevBlocks[prevBlocks.length - 1] : null;
      }
    } else {
      // When viewing latest, go to the last transaction block
      return transactionBlocks[transactionBlocks.length - 1];
    }
  };

  const getNextBlock = (): number | null => {
    if (transactionBlocks.length === 0) return null;

    // When viewing latest, no next block
    if (!isHistoricalView || currentBlockNumber === undefined) {
      return null;
    }

    // Find the index of current block in transaction blocks
    const currentIndex = transactionBlocks.indexOf(currentBlockNumber);

    if (currentIndex >= 0 && currentIndex < transactionBlocks.length - 1) {
      // We're at a block in the list, go to next one
      return transactionBlocks[currentIndex + 1];
    } else if (currentIndex === transactionBlocks.length - 1) {
      // We're at the last transaction block, no next
      return null;
    } else {
      // Current block not in list (might be clamped), find the smallest block > currentBlockNumber
      const nextBlock = transactionBlocks.find(b => b > currentBlockNumber);
      return nextBlock ?? null;
    }
  };

  const handlePreviousBlock = () => {
    const prevBlock = getPrevBlock();
    if (prevBlock !== null) {
      setBlockNumber(prevBlock);
    }
  };

  const handleNextBlock = () => {
    const nextBlock = getNextBlock();
    if (nextBlock !== null) {
      setBlockNumber(nextBlock);
    }
  };

  const handleBackToLatest = () => {
    setBlockNumber(undefined);
    setInputValue('');
  };

  const handleBlockInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlockInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGoToBlock();
  };

  /**
   * Binary search to find the largest block number <= target in sorted array
   * Clamps to first/last block if target is out of range
   * Returns the block number or null if blocks array is empty
   */
  const findLargestBlockLessThanOrEqual = (
    target: number,
    blocks: number[],
  ): number | null => {
    if (blocks.length === 0) {
      return null;
    }

    // Clamp to first block if target is smaller
    if (target < blocks[0]) {
      return blocks[0];
    }

    // Clamp to last block if target is larger
    if (target >= blocks[blocks.length - 1]) {
      return blocks[blocks.length - 1];
    }

    // Binary search for the largest block <= target
    let left = 0;
    let right = blocks.length - 1;
    let result = null;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (blocks[mid] <= target) {
        result = blocks[mid];
        left = mid + 1; // Try to find a larger block that's still <= target
      } else {
        right = mid - 1;
      }
    }

    return result;
  };

  const handleGoToBlock = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      // If we have transaction blocks, find the largest one <= input (with clamping)
      if (transactionBlocks.length > 0) {
        const targetBlock = findLargestBlockLessThanOrEqual(
          parsed,
          transactionBlocks,
        );
        // targetBlock should never be null if transactionBlocks.length > 0
        if (targetBlock !== null) {
          setBlockNumber(targetBlock);
        } else {
          // Fallback: use the input directly (shouldn't happen, but safety check)
          setBlockNumber(parsed);
        }
      } else {
        // Fallback: use the input directly if no transaction blocks available
        setBlockNumber(parsed);
      }
    } else {
      setInputValue('');
    }
  };

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

      {/* Historical Snapshot Banner */}
      {isHistoricalView && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-sm">
                  Viewing state at block #{currentBlockNumber?.toLocaleString()}
                </Badge>
                {warning && (
                  <Badge
                    variant="outline"
                    className="text-xs text-amber-600 dark:text-amber-400"
                  >
                    {warning}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBackToLatest();
                }}
                className="flex items-center gap-1"
                type="button"
                disabled={isLoading}
              >
                <RotateCcw className="h-4 w-4" />
                Back to Latest
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Block Selector Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Shareholders</CardTitle>
            <div className="flex items-center gap-2">
              <form
                onSubmit={handleBlockInputSubmit}
                className="flex items-center gap-2"
              >
                <Input
                  type="number"
                  placeholder="Block number"
                  value={inputValue}
                  onChange={handleBlockInputChange}
                  className="w-32"
                  min={firstBlock ?? 0}
                  max={latestBlock}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  onClick={e => {
                    e.preventDefault();
                    handleGoToBlock();
                  }}
                >
                  Go
                </Button>
              </form>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePreviousBlock();
                  }}
                  disabled={isLoading || getPrevBlock() === null}
                  title={(() => {
                    if (transactionBlocks.length === 0)
                      return 'Loading transaction blocks...';
                    const prevBlock = getPrevBlock();
                    return prevBlock !== null
                      ? `Go to block ${prevBlock}`
                      : 'No previous transaction block';
                  })()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNextBlock();
                  }}
                  disabled={isLoading || getNextBlock() === null}
                  title={(() => {
                    if (transactionBlocks.length === 0)
                      return 'Loading transaction blocks...';
                    const nextBlock = getNextBlock();
                    return nextBlock !== null
                      ? `Go to block ${nextBlock}`
                      : 'No next transaction block';
                  })()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {!isHistoricalView && (
                <Badge variant="outline" className="text-xs">
                  Latest
                </Badge>
              )}
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
