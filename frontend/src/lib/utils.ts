import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits } from 'viem';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format Ethereum address with truncation
 * @param addr - Address to format (optional)
 * @param opts - Formatting options
 * @returns Formatted address (e.g., "0x1234…5678") or "—" if empty
 */
export function formatAddress(
  addr?: string,
  opts: { size?: number } = {}
): string {
  if (!addr) return '—';
  const { size = 4 } = opts;
  const s = addr.toLowerCase();
  return `${s.slice(0, 2 + size)}…${s.slice(-size)}`;
}

/**
 * Format token amount from wei to human-readable format
 * @param raw - Amount in wei (bigint, string, or number)
 * @param decimals - Token decimals (default: 18)
 * @param opts - Formatting options
 * @returns Formatted amount (e.g., "1.23M" or "1,234,567.89")
 */
export function formatTokenAmount(
  raw: bigint | string | number,
  decimals: number = 18,
  opts: { compact?: boolean; maxFraction?: number } = {}
): string {
  const { compact = true, maxFraction = 2 } = opts;
  const bn = typeof raw === 'bigint' ? raw : BigInt(raw);
  const asUnits = formatUnits(bn, decimals); // string like "1234.5678"
  const n = Number(asUnits);
  
  if (!isFinite(n)) return asUnits;

  if (compact) {
    return Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: maxFraction,
    }).format(n);
  }
  
  return Intl.NumberFormat(undefined, {
    maximumFractionDigits: maxFraction,
  }).format(n);
}

/**
 * Format ISO date string to readable format
 * @param iso - ISO 8601 date string (optional)
 * @returns Formatted date (e.g., "Jan 1, 2025") or "—" if empty/invalid
 */
export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(+d) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
}

