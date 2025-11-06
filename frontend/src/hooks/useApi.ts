/**
 * @file React Query hooks for ChainEquity API
 * @notice Typed hooks for all API endpoints with proper error handling and pagination ergonomics
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getCompany,
  getCompanyMetadata,
  getCompanyStats,
  getShareholders,
  getShareholder,
  getMyShareholder,
  getPendingApprovals,
  getApprovedUsers,
  getTransactions,
  getTransactionByHash,
  linkWallet,
  unlinkWallet,
  getWalletStatus,
  getInvestorsWithWallets,
  type APIError,
  type WalletStatus,
  type InvestorWithWallet,
} from '../lib/api';
import type {
  CompanyInfo,
  CompanyMetadata,
  CompanyStats,
  Shareholder,
  ShareholdersResponse,
  ShareholdersQueryParams,
  TransactionsResponse,
  TransactionsQueryParams,
  TransactionDetail,
  PendingApprovalsResponse,
  ApprovedUsersResponse,
} from '../types/api';

// ============================================================================
// Company Hooks
// ============================================================================

/**
 * React Query hook for company information
 * GET /api/company
 *
 * @returns Query result with company info
 */
export function useCompany(): UseQueryResult<CompanyInfo, APIError> {
  return useQuery<CompanyInfo, APIError>({
    queryKey: ['company'],
    queryFn: () => getCompany(),
  });
}

/**
 * React Query hook for company metadata
 * GET /api/company/metadata
 *
 * @returns Query result with company metadata
 */
export function useCompanyMetadata(): UseQueryResult<CompanyMetadata, APIError> {
  return useQuery<CompanyMetadata, APIError>({
    queryKey: ['company', 'metadata'],
    queryFn: () => getCompanyMetadata(),
  });
}

/**
 * React Query hook for company statistics (dashboard)
 * GET /api/company/stats
 *
 * @returns Query result with comprehensive company statistics
 */
export function useCompanyStats(): UseQueryResult<CompanyStats, APIError> {
  return useQuery<CompanyStats, APIError>({
    queryKey: ['company', 'stats'],
    queryFn: () => getCompanyStats(),
    staleTime: 30_000, // 30 seconds
    retry: 1,
  });
}

// ============================================================================
// Shareholders Hooks
// ============================================================================

/**
 * React Query hook for paginated shareholders list
 * GET /api/shareholders
 *
 * @param params - Query parameters (limit, offset)
 * @returns Query result with paginated shareholders response
 */
export function useShareholders(
  params?: ShareholdersQueryParams
): UseQueryResult<ShareholdersResponse, APIError> {
  return useQuery<ShareholdersResponse, APIError>({
    queryKey: ['shareholders', params],
    queryFn: () => getShareholders(params),
  });
}

/**
 * Convenience hook that returns shareholders data in a composed format
 * Eliminates need to destructure `data.data` and `data.pagination`
 *
 * @param params - Query parameters (limit, offset, blockNumber)
 * @returns Composed object with shareholders, pagination, supply info, and block metadata
 */
export function useShareholdersData(params?: ShareholdersQueryParams) {
  const query = useShareholders(params);
  
  return {
    ...query,
    shareholders: query.data?.shareholders ?? [],
    pagination: query.data?.pagination,
    totalSupply: query.data?.totalSupply,
    totalEffectiveSupply: query.data?.totalEffectiveSupply,
    blockNumber: query.data?.blockNumber,
    latestBlock: query.data?.latestBlock,
    firstBlock: query.data?.firstBlock,
    nextBlock: query.data?.nextBlock,
    prevBlock: query.data?.prevBlock,
    transactionBlocks: query.data?.transactionBlocks ?? [],
    warning: query.data?.warning,
  };
}

/**
 * React Query hook for individual shareholder details
 * GET /api/shareholders/:address
 *
 * @param address - Shareholder Ethereum address
 * @param enabled - Whether the query should be enabled (default: true if address provided)
 * @returns Query result with shareholder details
 */
export function useShareholder(
  address: string | undefined,
  enabled: boolean = true
): UseQueryResult<Shareholder, APIError> {
  return useQuery<Shareholder, APIError>({
    queryKey: ['shareholder', address],
    queryFn: () => {
      if (!address) {
        throw new Error('Address is required');
      }
      return getShareholder(address);
    },
    enabled: enabled && !!address,
    // Don't use stale data if address changes or query is disabled
    staleTime: enabled && !!address ? 0 : Infinity,
    gcTime: enabled && !!address ? 5 * 60 * 1000 : 0, // 5 minutes if enabled, 0 if disabled
    retry: (failureCount, error) => {
      // Don't retry on 404 (wallet has no balance yet, which is fine)
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return false;
      }
      // Retry other errors up to 1 time
      return failureCount < 1;
    },
    retryOnMount: false, // Don't retry on mount if it failed before
  });
}

/**
 * React Query hook for current user's shareholder information
 * GET /api/shareholders/me
 * Queries by user ID (foundational), not wallet address
 *
 * @returns Query result with shareholder details for authenticated user's linked wallet
 */
export function useMyShareholder(): UseQueryResult<Shareholder, APIError> {
  return useQuery<Shareholder, APIError>({
    queryKey: ['shareholder', 'me'],
    queryFn: () => getMyShareholder(),
    retry: (failureCount, error) => {
      // Don't retry on 404 (wallet not linked)
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

/**
 * React Query hook for pending wallet approvals
 * GET /api/shareholders/pending
 *
 * @returns Query result with list of pending approvals
 */
export function usePendingApprovals(): UseQueryResult<PendingApprovalsResponse, APIError> {
  return useQuery<PendingApprovalsResponse, APIError>({
    queryKey: ['shareholders', 'pending'],
    queryFn: () => getPendingApprovals(),
  });
}

/**
 * React Query hook for approved wallet users
 * GET /api/shareholders/approved
 *
 * @returns Query result with list of approved users
 */
export function useApprovedUsers(): UseQueryResult<ApprovedUsersResponse, APIError> {
  return useQuery<ApprovedUsersResponse, APIError>({
    queryKey: ['shareholders', 'approved'],
    queryFn: () => getApprovedUsers(),
  });
}

// ============================================================================
// Transactions Hooks
// ============================================================================

/**
 * React Query hook for paginated transaction history
 * GET /api/transactions
 *
 * @param params - Query parameters (limit, offset, eventType, address, fromDate, toDate)
 * @returns Query result with paginated transactions response
 */
export function useTransactions(
  params?: TransactionsQueryParams
): UseQueryResult<TransactionsResponse, APIError> {
  return useQuery<TransactionsResponse, APIError>({
    queryKey: ['transactions', params],
    queryFn: () => getTransactions(params),
  });
}

/**
 * Convenience hook that returns transactions data in a composed format
 * Eliminates need to destructure `data.data` and `data.pagination`
 *
 * @param params - Query parameters (limit, offset, eventType, address, fromDate, toDate)
 * @returns Composed object with transactions and pagination
 */
export function useTransactionsData(params?: TransactionsQueryParams) {
  const query = useTransactions(params);
  
  return {
    ...query,
    transactions: query.data?.transactions ?? [],
    pagination: query.data?.pagination,
  };
}

/**
 * React Query hook for transaction details by hash
 * GET /api/transactions/:txHash
 *
 * @param txHash - Transaction hash (0x-prefixed hex string)
 * @param enabled - Whether the query should be enabled (default: true if txHash provided)
 * @returns Query result with transaction details
 */
export function useTransaction(
  txHash: string | undefined,
  enabled: boolean = true
): UseQueryResult<TransactionDetail, APIError> {
  return useQuery<TransactionDetail, APIError>({
    queryKey: ['transaction', txHash],
    queryFn: () => {
      if (!txHash) {
        throw new Error('Transaction hash is required');
      }
      return getTransactionByHash(txHash);
    },
    enabled: enabled && !!txHash,
  });
}

// ============================================================================
// Wallet Hooks
// ============================================================================

/**
 * React Query hook for wallet linking status
 * GET /api/wallet/status
 *
 * @returns Query result with wallet status
 */
export function useWalletStatus(): UseQueryResult<WalletStatus, APIError> {
  return useQuery<WalletStatus, APIError>({
    queryKey: ['wallet', 'status'],
    queryFn: () => getWalletStatus(),
  });
}

/**
 * React Query hook for investors with linked wallets
 * GET /api/wallet/investors
 *
 * @returns Query result with list of investors
 */
export function useInvestorsWithWallets(): UseQueryResult<{ investors: InvestorWithWallet[] }, APIError> {
  return useQuery<{ investors: InvestorWithWallet[] }, APIError>({
    queryKey: ['wallet', 'investors'],
    queryFn: () => getInvestorsWithWallets(),
  });
}

