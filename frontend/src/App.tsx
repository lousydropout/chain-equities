import { useState } from 'react';
import './App.css';
import { useAuth } from './hooks/useAuth';

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
      <div className="container">
        <h1>ChainEquity Demo</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>ChainEquity Demo - Mock Auth</h1>

      <div className="card">
        {isAuthenticated && user ? (
          <div>
            <h2>Authenticated</h2>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Role:</strong> {user.role}
            </p>
            <p>
              <strong>UID:</strong> {user.uid}
            </p>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <div>
            <h2>Not logged in</h2>
            <p>Click the button below to simulate login with demo user.</p>
            <button onClick={handleLogin} disabled={isLoading}>
              Login (Demo)
            </button>
            {loginError && (
              <p style={{ color: 'red', marginTop: '1rem' }}>
                Error: {loginError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
