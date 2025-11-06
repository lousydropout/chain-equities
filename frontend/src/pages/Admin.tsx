/**
 * @file Admin page for ChainEquity frontend
 * @notice Admin-only page demonstrating role-based route protection
 */

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Admin page component
 * Protected by requiredRole="admin"
 */
export function Admin() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Admin Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Admin Access</CardTitle>
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
              This page is only accessible to users with the 'admin' role.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

