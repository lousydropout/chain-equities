/**
 * @file API client for ChainEquity frontend
 * @notice Composable API client with centralized fetch logic, error handling, and token attachment
 */

import { getAuthToken, getAuthUser } from './auth';
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

/**
 * API Error class for typed error handling
 */
export class APIError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * API client type
 */
export type ApiClient = {
  apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T>;
};

/**
 * Composable API client factory
 * Allows creating multiple client instances for different tenants/base URLs
 *
 * @param baseUrl - Base URL for API requests
 * @param tokenGetter - Function that returns the auth token (or null)
 * @returns API client instance with apiRequest method
 */
export function createApiClient(
  baseUrl: string,
  tokenGetter: () => string | null
): ApiClient {
  /**
   * Centralized fetch wrapper with automatic JSON parsing for both success and error responses
   *
   * @param endpoint - API endpoint (e.g., '/api/company')
   * @param options - Fetch options (method, body, etc.)
   * @returns Typed response data
   * @throws APIError for non-ok responses or network errors
   */
  async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = tokenGetter();
    const headers = new Headers(options?.headers);
    
    // Set Content-Type for JSON requests
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    // Attach auth token if available
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    // In demo mode, send user info in custom headers so backend knows which user
    const userStr = getAuthUser();
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        headers.set('X-User-Uid', user.uid || '');
        headers.set('X-User-Email', user.email || '');
        headers.set('X-User-Role', user.role || '');
      } catch (err) {
        // Ignore parsing errors
      }
    }
    
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
      
      // Parse JSON for both success and error responses
      const data = await res.json().catch(() => undefined);
      
      if (!res.ok) {
        // Extract error message from response body, fallback to statusText
        const errorMessage =
          data?.message ?? data?.error ?? res.statusText ?? 'Unknown error';
        
        throw new APIError(res.status, errorMessage, data);
      }
      
      return data as T;
    } catch (error) {
      // Re-throw APIError as-is
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new APIError(
          0,
          'Network error: Failed to connect to server',
          error
        );
      }
      
      // Re-throw other errors
      throw error;
    }
  }
  
  return { apiRequest };
}

/**
 * Default API client instance
 * Uses environment variable for base URL, defaults to http://localhost:4000
 */
export const api = createApiClient(
  import.meta.env.VITE_API_URL || 'http://localhost:4000',
  getAuthToken
);

// ============================================================================
// Company API Functions
// ============================================================================

/**
 * Get company information
 * GET /api/company
 *
 * @returns Company information including name, symbol, issuer, token address, etc.
 * @throws APIError on error
 */
export async function getCompany(): Promise<CompanyInfo> {
  return api.apiRequest<CompanyInfo>('/api/company');
}

/**
 * Get company metadata
 * GET /api/company/metadata
 *
 * @returns Company metadata (name, symbol, issuer, creation timestamp, token link status)
 * @throws APIError on error
 */
export async function getCompanyMetadata(): Promise<CompanyMetadata> {
  return api.apiRequest<CompanyMetadata>('/api/company/metadata');
}

/**
 * Get company statistics for dashboard
 * GET /api/company/stats
 *
 * @returns Comprehensive company statistics including totals, shareholders count, etc.
 * @throws APIError on error
 */
export async function getCompanyStats(): Promise<CompanyStats> {
  return api.apiRequest<CompanyStats>('/api/company/stats');
}

// ============================================================================
// Shareholders API Functions
// ============================================================================

/**
 * Get paginated list of shareholders (cap table)
 * GET /api/shareholders
 *
 * @param params - Query parameters (limit, offset)
 * @returns Paginated shareholders response with pagination metadata and supply info
 * @throws APIError on error
 */
export async function getShareholders(
  params?: ShareholdersQueryParams
): Promise<ShareholdersResponse> {
  const searchParams = new URLSearchParams();
  
  if (params?.limit !== undefined) {
    searchParams.set('limit', params.limit.toString());
  }
  if (params?.offset !== undefined) {
    searchParams.set('offset', params.offset.toString());
  }
  if (params?.blockNumber !== undefined) {
    searchParams.set('blockNumber', params.blockNumber.toString());
  }
  
  const queryString = searchParams.toString();
  const endpoint = queryString ? `/api/shareholders?${queryString}` : '/api/shareholders';
  
  return api.apiRequest<ShareholdersResponse>(endpoint);
}

/**
 * Get individual shareholder details
 * GET /api/shareholders/:address
 *
 * @param address - Shareholder Ethereum address
 * @returns Shareholder details including balance, effective balance, ownership percentage
 * @throws APIError on error (404 if shareholder not found)
 */
export async function getShareholder(address: string): Promise<Shareholder> {
  return api.apiRequest<Shareholder>(`/api/shareholders/${encodeURIComponent(address)}`);
}

/**
 * Get current user's shareholder information
 * GET /api/shareholders/me
 * Queries by user ID (foundational), not wallet address
 *
 * @returns Shareholder details for authenticated user's linked wallet
 * @throws APIError on error (404 if wallet not linked)
 */
export async function getMyShareholder(): Promise<Shareholder> {
  return api.apiRequest<Shareholder>('/api/shareholders/me');
}

/**
 * Get pending wallet approvals
 * GET /api/shareholders/pending
 *
 * @returns List of investors with linked wallets that are not approved on contract
 * @throws APIError on error
 */
export async function getPendingApprovals(): Promise<PendingApprovalsResponse> {
  return api.apiRequest<PendingApprovalsResponse>('/api/shareholders/pending');
}

/**
 * Get approved wallet users
 * GET /api/shareholders/approved
 *
 * @returns List of investors with linked wallets that are approved on contract
 * @throws APIError on error
 */
export async function getApprovedUsers(): Promise<ApprovedUsersResponse> {
  return api.apiRequest<ApprovedUsersResponse>('/api/shareholders/approved');
}

/**
 * Get list of blocks with transactions
 * GET /api/shareholders/blocks
 *
 * @returns List of distinct block numbers that have transactions
 * @throws APIError on error
 */
export async function getBlocksWithTransactions(): Promise<{ blocks: number[] }> {
  return api.apiRequest<{ blocks: number[] }>('/api/shareholders/blocks');
}

// ============================================================================
// Transactions API Functions
// ============================================================================

/**
 * Get paginated transaction history with optional filtering
 * GET /api/transactions
 *
 * @param params - Query parameters (limit, offset, eventType, address, fromDate, toDate)
 * @returns Paginated transactions response
 * @throws APIError on error
 */
export async function getTransactions(
  params?: TransactionsQueryParams
): Promise<TransactionsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params?.limit !== undefined) {
    searchParams.set('limit', params.limit.toString());
  }
  if (params?.offset !== undefined) {
    searchParams.set('offset', params.offset.toString());
  }
  if (params?.eventType) {
    searchParams.set('eventType', params.eventType);
  }
  if (params?.address) {
    searchParams.set('address', params.address);
  }
  if (params?.fromDate !== undefined) {
    searchParams.set('fromDate', params.fromDate.toString());
  }
  if (params?.toDate !== undefined) {
    searchParams.set('toDate', params.toDate.toString());
  }
  
  const queryString = searchParams.toString();
  const endpoint = queryString ? `/api/transactions?${queryString}` : '/api/transactions';
  
  return api.apiRequest<TransactionsResponse>(endpoint);
}

/**
 * Get transaction details by transaction hash
 * GET /api/transactions/:txHash
 *
 * @param txHash - Transaction hash (0x-prefixed hex string)
 * @returns Transaction detail with all events in the transaction
 * @throws APIError on error (404 if transaction not found)
 */
export async function getTransactionByHash(txHash: string): Promise<TransactionDetail> {
  return api.apiRequest<TransactionDetail>(
    `/api/transactions/${encodeURIComponent(txHash)}`
  );
}

// ============================================================================
// Wallet API Functions
// ============================================================================

/**
 * Wallet status response
 */
export interface WalletStatus {
  walletAddress: string | null;
  isLinked: boolean;
}

/**
 * Link wallet address to user account
 * POST /api/wallet/link
 *
 * @param walletAddress - Ethereum wallet address to link
 * @returns Success response with linked wallet address
 * @throws APIError on error
 */
export async function linkWallet(walletAddress: string): Promise<{ success: boolean; message: string; walletAddress: string }> {
  return api.apiRequest<{ success: boolean; message: string; walletAddress: string }>(
    '/api/wallet/link',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    }
  );
}

/**
 * Unlink wallet address from user account
 * POST /api/wallet/unlink
 *
 * @returns Success response
 * @throws APIError on error
 */
export async function unlinkWallet(): Promise<{ success: boolean; message: string }> {
  return api.apiRequest<{ success: boolean; message: string }>(
    '/api/wallet/unlink',
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
}

/**
 * Get wallet linking status for current user
 * GET /api/wallet/status
 *
 * @returns Wallet status (address and linked status)
 * @throws APIError on error
 */
export async function getWalletStatus(): Promise<WalletStatus> {
  return api.apiRequest<WalletStatus>('/api/wallet/status');
}

/**
 * Investor with linked wallet
 */
export interface InvestorWithWallet {
  uid: string;
  email: string;
  displayName: string;
  walletAddress: string;
}

/**
 * Get list of investors with linked wallets
 * GET /api/wallet/investors
 *
 * @returns List of investors with their linked wallet addresses
 * @throws APIError on error
 */
export async function getInvestorsWithWallets(): Promise<{ investors: InvestorWithWallet[] }> {
  return api.apiRequest<{ investors: InvestorWithWallet[] }>('/api/wallet/investors');
}

