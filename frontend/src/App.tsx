import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { Connect } from './components/Connect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function App() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await login();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  const handleLogout = () => {
    logout();
    setLoginError(null);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">ChainEquity Demo</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">
        ChainEquity Demo - Mock Auth
      </h1>

      <Connect />

      <Card>
        <CardHeader>
          <CardTitle>
            {isAuthenticated && user ? 'Authenticated' : 'Not logged in'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAuthenticated && user ? (
            <div className="space-y-3">
              <div>
                <span className="font-semibold">Email:</span> {user.email}
              </div>
              <div>
                <span className="font-semibold">Role:</span> {user.role}
              </div>
              <div>
                <span className="font-semibold">UID:</span> {user.uid}
              </div>
              <Button onClick={handleLogout} variant="outline" className="w-full">
                Logout
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Click the button below to simulate login with demo user.
              </p>
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full"
              >
                Login (Demo)
              </Button>
              {loginError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">Error: {loginError}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
