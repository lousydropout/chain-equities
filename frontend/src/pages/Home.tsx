/**
 * @file Home page for ChainEquity frontend
 * @notice Placeholder home page - will be enhanced in Task 4.8 (Company Dashboard)
 */

import { useAuth } from '@/hooks/useAuth';
import { Connect } from '@/components/Connect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Home page component
 * Placeholder for future dashboard implementation
 */
export function Home() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">ChainEquity Demo</h1>

      <Connect />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Welcome, {user?.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <span className="font-semibold">Email:</span> {user?.email}
            </div>
            <div>
              <span className="font-semibold">Role:</span> {user?.role}
            </div>
            <div>
              <span className="font-semibold">UID:</span> {user?.uid}
            </div>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

