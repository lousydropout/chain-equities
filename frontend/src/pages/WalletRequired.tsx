/**
 * @file Wallet Required page for ChainEquity frontend
 * @notice Page requiring wallet connection, demonstrating wallet-based route protection
 */

import { useAuth } from '@/hooks/useAuth';
import { useAccount } from 'wagmi';
import { Connect } from '@/components/Connect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Wallet Required page component
 * Protected by requireWallet={true}
 */
export function WalletRequired() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Wallet Required Page</h1>

      <Connect />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Wallet Connection Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <span className="font-semibold">Welcome, {user?.email}</span>
            </div>
            <div>
              <span className="font-semibold">Role:</span> {user?.role}
            </div>
            {isConnected && address && (
              <div>
                <span className="font-semibold">Connected Wallet:</span>{' '}
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {address}
                </code>
              </div>
            )}
            <p className="text-muted-foreground mt-4">
              This page requires a connected wallet. Connect your wallet above to
              access this page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

