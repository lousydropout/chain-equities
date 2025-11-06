/**
 * @file API Test page for ChainEquity frontend
 * @notice Test page to verify API client integration with all endpoints
 */

import {
  useCompany,
  useCompanyMetadata,
  useShareholders,
  useShareholdersData,
  useTransactions,
  useTransactionsData,
} from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * API Test page component
 * Displays data from all API endpoints to verify integration
 */
export function APITest() {
  // Company endpoints
  const company = useCompany();
  const companyMetadata = useCompanyMetadata();

  // Shareholders endpoints
  const shareholders = useShareholders({ limit: 10, offset: 0 });
  const shareholdersData = useShareholdersData({ limit: 10, offset: 0 });

  // Transactions endpoints
  const transactions = useTransactions({ limit: 10, offset: 0 });
  const transactionsData = useTransactionsData({ limit: 10, offset: 0 });

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <h1 className="text-4xl font-bold mb-8 text-center">API Client Test Page</h1>
      <p className="text-center text-muted-foreground mb-8">
        This page tests all API endpoints to verify the client integration
      </p>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle>Company Info (GET /api/company)</CardTitle>
        </CardHeader>
        <CardContent>
          {company.isLoading && <p>Loading...</p>}
          {company.error && (
            <div className="text-red-500">
              <p className="font-semibold">Error:</p>
              <p>Status: {company.error.status}</p>
              <p>Message: {company.error.message}</p>
            </div>
          )}
          {company.data && (
            <div className="space-y-2 font-mono text-sm">
              <div>
                <span className="font-semibold">Name:</span> {company.data.name}
              </div>
              <div>
                <span className="font-semibold">Symbol:</span> {company.data.symbol}
              </div>
              <div>
                <span className="font-semibold">Issuer:</span> {company.data.issuer}
              </div>
              <div>
                <span className="font-semibold">Token:</span>{' '}
                {company.data.token || 'Not linked'}
              </div>
              <div>
                <span className="font-semibold">Cap Table:</span>{' '}
                {company.data.capTableAddress}
              </div>
              <div>
                <span className="font-semibold">Created:</span>{' '}
                {new Date(company.data.createdAt * 1000).toLocaleString()}
              </div>
              <div>
                <span className="font-semibold">Token Linked:</span>{' '}
                {company.data.isTokenLinked ? 'Yes' : 'No'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Company Metadata (GET /api/company/metadata)</CardTitle>
        </CardHeader>
        <CardContent>
          {companyMetadata.isLoading && <p>Loading...</p>}
          {companyMetadata.error && (
            <div className="text-red-500">
              <p className="font-semibold">Error:</p>
              <p>Status: {companyMetadata.error.status}</p>
              <p>Message: {companyMetadata.error.message}</p>
            </div>
          )}
          {companyMetadata.data && (
            <div className="space-y-2 font-mono text-sm">
              <div>
                <span className="font-semibold">Name:</span> {companyMetadata.data.name}
              </div>
              <div>
                <span className="font-semibold">Symbol:</span>{' '}
                {companyMetadata.data.symbol}
              </div>
              <div>
                <span className="font-semibold">Issuer:</span>{' '}
                {companyMetadata.data.issuer}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shareholders (using hook) */}
      <Card>
        <CardHeader>
          <CardTitle>Shareholders (GET /api/shareholders) - Hook</CardTitle>
        </CardHeader>
        <CardContent>
          {shareholders.isLoading && <p>Loading...</p>}
          {shareholders.error && (
            <div className="text-red-500">
              <p className="font-semibold">Error:</p>
              <p>Status: {shareholders.error.status}</p>
              <p>Message: {shareholders.error.message}</p>
            </div>
          )}
          {shareholders.data && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Total: {shareholders.data.pagination.total} | Showing:{' '}
                {shareholders.data.shareholders.length}
              </div>
              <div className="space-y-2 font-mono text-sm max-h-60 overflow-y-auto">
                {shareholders.data.shareholders.map((sh) => (
                  <div key={sh.address} className="border-b pb-2">
                    <div className="font-semibold">{sh.address}</div>
                    <div>
                      Balance: {sh.balance} | Effective: {sh.effectiveBalance}
                    </div>
                    <div>Ownership: {sh.ownershipPercentage.toFixed(2)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shareholders (using data helper) */}
      <Card>
        <CardHeader>
          <CardTitle>Shareholders - Data Helper (useShareholdersData)</CardTitle>
        </CardHeader>
        <CardContent>
          {shareholdersData.isLoading && <p>Loading...</p>}
          {shareholdersData.error && (
            <div className="text-red-500">
              <p className="font-semibold">Error:</p>
              <p>Status: {shareholdersData.error.status}</p>
              <p>Message: {shareholdersData.error.message}</p>
            </div>
          )}
          {shareholdersData.shareholders.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Direct access (no data.shareholders): {shareholdersData.shareholders.length}{' '}
                shareholders
              </div>
              <div className="text-sm text-muted-foreground">
                Total Supply: {shareholdersData.totalSupply}
              </div>
              <div className="text-sm text-muted-foreground">
                Effective Supply: {shareholdersData.totalEffectiveSupply}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions (using hook) */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions (GET /api/transactions) - Hook</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.isLoading && <p>Loading...</p>}
          {transactions.error && (
            <div className="text-red-500">
              <p className="font-semibold">Error:</p>
              <p>Status: {transactions.error.status}</p>
              <p>Message: {transactions.error.message}</p>
            </div>
          )}
          {transactions.data && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Total: {transactions.data.pagination.total} | Showing:{' '}
                {transactions.data.transactions.length}
              </div>
              <div className="space-y-2 font-mono text-sm max-h-60 overflow-y-auto">
                {transactions.data.transactions.map((tx) => (
                  <div key={tx.id} className="border-b pb-2">
                    <div className="font-semibold">{tx.eventType}</div>
                    <div>Tx: {tx.txHash.slice(0, 20)}...</div>
                    <div>
                      {tx.fromAddress
                        ? `From: ${tx.fromAddress.slice(0, 10)}...`
                        : 'Mint'}
                      {' → '}
                      {tx.toAddress
                        ? `To: ${tx.toAddress.slice(0, 10)}...`
                        : 'Burn'}
                    </div>
                    <div>Amount: {tx.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions (using data helper) */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions - Data Helper (useTransactionsData)</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsData.isLoading && <p>Loading...</p>}
          {transactionsData.error && (
            <div className="text-red-500">
              <p className="font-semibold">Error:</p>
              <p>Status: {transactionsData.error.status}</p>
              <p>Message: {transactionsData.error.message}</p>
            </div>
          )}
          {transactionsData.transactions.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Direct access (no data.transactions): {transactionsData.transactions.length}{' '}
              transactions
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button
          onClick={() => {
            window.location.reload();
          }}
          variant="outline"
        >
          Refresh All Data
        </Button>
      </div>
    </div>
  );
}

