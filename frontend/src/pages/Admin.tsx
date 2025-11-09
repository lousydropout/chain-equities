/**
 * @file Admin page for ChainEquity frontend
 * @notice Admin-only page with corporate actions: share splits and symbol changes
 */

import { useAuth } from '@/hooks/useAuth';
import { useCompanyStats } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExecuteSplitForm } from '@/components/ExecuteSplitForm';
import { ChangeSymbolForm } from '@/components/ChangeSymbolForm';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Admin page component
 * Protected by requiredRole="admin"
 */
export function Admin() {
  const { user } = useAuth();
  const { data: companyStats, isLoading, isError, error } = useCompanyStats();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Company Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {error?.message || 'Failed to load company information'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tokenAddress = companyStats?.tokenAddress;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage corporate actions and company settings
        </p>
      </div>

      {!tokenAddress && (
        <Card className="border-yellow-200 dark:border-yellow-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              Token Not Linked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The token contract is not linked to the cap table. Please deploy
              and link the token contract before performing corporate actions.
            </p>
          </CardContent>
        </Card>
      )}

      {tokenAddress && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExecuteSplitForm tokenAddress={tokenAddress} />
          <ChangeSymbolForm tokenAddress={tokenAddress} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Admin Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="font-semibold">Welcome, </span>
            <span>{user?.email}</span>
          </div>
          <div>
            <span className="font-semibold">Role: </span>
            <span>{user?.role}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            This page is only accessible to users with the 'admin' role. Use the
            forms above to execute corporate actions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

