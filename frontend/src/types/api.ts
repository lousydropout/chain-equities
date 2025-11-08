/**
 * @file API response types for ChainEquity frontend
 * @notice TypeScript types matching backend response schemas
 */

/**
 * Pagination metadata
 */
export interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

/**
 * Company information response from GET /api/company
 */
export interface CompanyInfo {
  name: string;
  symbol: string;
  issuer: string;
  token: string | null;
  capTableAddress: string;
  createdAt: number;
  isTokenLinked: boolean;
}

/**
 * Company metadata response from GET /api/company/metadata
 */
export interface CompanyMetadata {
  name: string;
  symbol: string;
  issuer: string;
  createdAt: number;
  isTokenLinked: boolean;
  token: string | null;
}

/**
 * Company stats response from GET /api/company/stats
 * Comprehensive dashboard statistics combining contract and database data
 */
export interface CompanyStats {
  name: string;
  symbol: string;
  issuer: string;
  createdAt: string; // ISO 8601 date string
  tokenLinked: boolean;
  tokenAddress: string | null;
  totalShareholders: number;
  totalAuthorized: string; // wei as string
  totalOutstanding: string; // wei as string
  decimals: number;
  splitFactor?: string; // optional, wei as string
}

/**
 * Individual shareholder object
 */
export interface Shareholder {
  address: string;
  balance: string;
  effectiveBalance: string;
  ownershipPercentage: number;
  lastUpdatedBlock: number | null;
  email?: string | null;
  displayName?: string | null;
}

/**
 * Paginated shareholders response from GET /api/shareholders
 */
export interface ShareholdersResponse {
  shareholders: Shareholder[];
  pagination: Pagination;
  totalSupply: string;
  totalEffectiveSupply: string;
  blockNumber: number;
}

/**
 * Transaction event type
 */
export type TransactionEventType = 'ISSUED' | 'TRANSFER';

/**
 * Transaction object
 */
export interface Transaction {
  id: number;
  txHash: string;
  fromAddress: string | null;
  toAddress: string | null;
  amount: string;
  blockNumber: number;
  blockTimestamp: number | null;
  logIndex: number;
  eventType: TransactionEventType;
}

/**
 * Transaction detail (nested transaction without txHash)
 */
export interface TransactionDetailItem {
  id: number;
  fromAddress: string | null;
  toAddress: string | null;
  amount: string;
  blockNumber: number;
  blockTimestamp: number | null;
  logIndex: number;
  eventType: TransactionEventType;
}

/**
 * Paginated transactions response from GET /api/transactions
 */
export interface TransactionsResponse {
  transactions: Transaction[];
  pagination: Pagination;
}

/**
 * Transaction detail response from GET /api/transactions/:txHash
 */
export interface TransactionDetail {
  txHash: string;
  transactions: TransactionDetailItem[];
  blockNumber: number;
  blockTimestamp: number | null;
}

/**
 * API error response structure
 */
export interface APIErrorResponse {
  error: string;
  message: string;
}

/**
 * Query parameters for GET /api/shareholders
 */
export interface ShareholdersQueryParams {
  limit?: number;
  offset?: number;
  blockNumber?: number;
}

/**
 * Query parameters for GET /api/transactions
 */
export interface TransactionsQueryParams {
  limit?: number;
  offset?: number;
  eventType?: TransactionEventType;
  address?: string;
  fromDate?: number;
  toDate?: number;
}

/**
 * Pending approval investor object
 */
export interface PendingApproval {
  uid: string;
  email: string;
  displayName: string;
  walletAddress: string;
  isApproved: boolean;
}

/**
 * Pending approvals response from GET /api/shareholders/pending
 */
export interface PendingApprovalsResponse {
  pending: PendingApproval[];
}

/**
 * Approved users response from GET /api/shareholders/approved
 */
export interface ApprovedUsersResponse {
  approved: PendingApproval[];
}

