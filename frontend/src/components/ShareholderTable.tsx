/**
 * @file Shareholder Table Component
 * @notice Reusable table component for displaying shareholders with client-side sorting
 */

import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Info } from 'lucide-react';
import { formatTokenAmount } from '@/lib/utils';
import type { Shareholder } from '@/types/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface ShareholderTableProps {
  shareholders: Shareholder[];
  totalOutstanding: bigint;
  decimals?: number;
  defaultSort?: 'ownership' | 'balance' | 'address';
}

type SortField = 'address' | 'balance' | 'effectiveBalance' | 'ownership';
type SortDirection = 'asc' | 'desc';

/**
 * ShareholderTable component
 * Displays shareholders in a sortable table with ownership percentages and progress bars
 */
export function ShareholderTable({
  shareholders,
  totalOutstanding,
  decimals = 18,
  defaultSort = 'ownership',
}: ShareholderTableProps) {
  const [sortField, setSortField] = useState<SortField>(
    defaultSort === 'ownership'
      ? 'ownership'
      : defaultSort === 'balance'
        ? 'balance'
        : 'address',
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort shareholders based on current sort field and direction
  const sortedShareholders = useMemo(() => {
    const sorted = [...shareholders];

    sorted.sort((a, b) => {
      let aValue: number | string | bigint;
      let bValue: number | string | bigint;

      switch (sortField) {
        case 'address':
          // Sort by displayName/email first, then by address
          const aUser = a.displayName || a.email || '';
          const bUser = b.displayName || b.email || '';
          if (aUser && bUser) {
            aValue = aUser.toLowerCase();
            bValue = bUser.toLowerCase();
          } else if (aUser) {
            // a has user info, b doesn't - a comes first in desc, last in asc
            return sortDirection === 'asc' ? 1 : -1;
          } else if (bUser) {
            // b has user info, a doesn't - b comes first in desc, last in asc
            return sortDirection === 'asc' ? -1 : 1;
          } else {
            // Neither has user info, sort by address
            aValue = a.address.toLowerCase();
            bValue = b.address.toLowerCase();
          }
          break;
        case 'balance':
          aValue = BigInt(a.balance ?? 0);
          bValue = BigInt(b.balance ?? 0);
          break;
        case 'effectiveBalance':
          aValue = BigInt(a.effectiveBalance ?? a.balance ?? 0);
          bValue = BigInt(b.effectiveBalance ?? b.balance ?? 0);
          break;
        case 'ownership':
          aValue =
            a.ownershipPercentage ??
            (totalOutstanding > 0n
              ? (Number(BigInt(a.effectiveBalance ?? a.balance ?? 0)) /
                  Number(totalOutstanding)) *
                100
              : 0);
          bValue =
            b.ownershipPercentage ??
            (totalOutstanding > 0n
              ? (Number(BigInt(b.effectiveBalance ?? b.balance ?? 0)) /
                  Number(totalOutstanding)) *
                100
              : 0);
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
  }, [shareholders, sortField, sortDirection, totalOutstanding]);

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

  if (shareholders.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No shareholders found.
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
              onClick={() => handleSort('address')}
            >
              <div className="inline-flex items-center gap-1">
                Address
                <SortIcon field="address" />
              </div>
            </th>
            <th
              className="text-right py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('balance')}
            >
              <div className="inline-flex items-center gap-1 justify-end">
                Balance
                <SortIcon field="balance" />
              </div>
            </th>
            <th
              className="text-right py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('effectiveBalance')}
            >
              <div className="inline-flex items-center gap-1 justify-end">
                Effective Balance
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Balance adjusted for share splits (multiplied by split
                        factor)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <SortIcon field="effectiveBalance" />
              </div>
            </th>
            <th
              className="text-right py-2 px-4 cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('ownership')}
            >
              <div className="inline-flex items-center gap-1 justify-end">
                Ownership %
                <SortIcon field="ownership" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedShareholders.map((shareholder, i) => {
            const balance = BigInt(shareholder.balance ?? 0);
            const effectiveBalance = BigInt(
              shareholder.effectiveBalance ?? shareholder.balance ?? 0,
            );
            // Use ownership percentage from API, or calculate it
            const ownershipPct =
              shareholder.ownershipPercentage ??
              (totalOutstanding > 0n
                ? (Number(effectiveBalance) / Number(totalOutstanding)) * 100
                : 0);

            return (
              <tr
                key={shareholder.address ?? i}
                className={i % 2 === 0 ? 'bg-muted/20' : ''}
              >
                <td className="py-2 px-4 font-mono">
                  {shareholder.displayName || shareholder.email ? (
                    <div>
                      <p className='font-semibold'>{shareholder.displayName} ({shareholder.email})</p> 
                      <p>{shareholder.address}</p>
                    </div>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td className="py-2 px-4 text-right font-mono">
                  {formatTokenAmount(balance, decimals, {
                    maxFraction: decimals,
                    compact: false,
                  })}
                </td>
                <td className="py-2 px-4 text-right font-mono">
                  {formatTokenAmount(effectiveBalance, decimals, {
                    maxFraction: decimals,
                    compact: false,
                  })}
                </td>
                <td className="py-2 px-4 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span>{ownershipPct.toFixed(2)}%</span>
                    {/* Progress bar for ownership visualization */}
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(ownershipPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
