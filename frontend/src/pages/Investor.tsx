/**
 * @file Investor page for ChainEquity frontend
 * @notice Investor-only page demonstrating role-based route protection
 */

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Investor page component
 * Protected by requiredRole="investor"
 */
export function Investor() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Investor Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Investor Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <span className="font-semibold">Welcome, {user?.email}</span>
            </div>
            <div>
              <span className="font-semibold">Role:</span> {user?.role}
            </div>
            <p className="text-muted-foreground mt-4">
              This page is only accessible to users with the 'investor' role.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

