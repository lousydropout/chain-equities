/**
 * @file Main App component with routing
 * @notice Routes for Login, Register, and protected Home page
 */

import { type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { CapTable } from './pages/CapTable';
import { Approvals } from './pages/Approvals';
import { Admin } from './pages/Admin';
import { Investor } from './pages/Investor';
import { WalletRequired } from './pages/WalletRequired';
import { APITest } from './pages/APITest';
import { ProtectedRoute } from './components/ProtectedRoute';

/**
 * Component to redirect authenticated users away from auth pages
 */
function AuthRedirect({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Main App component with routing
 */
function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthRedirect>
            <Login />
          </AuthRedirect>
        }
      />
      <Route
        path="/register"
        element={
          <AuthRedirect>
            <Register />
          </AuthRedirect>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      {/* Admin-only route - requires admin role */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <Admin />
          </ProtectedRoute>
        }
      />
      {/* Investor-only route - requires investor role */}
      <Route
        path="/investor"
        element={
          <ProtectedRoute requiredRole="investor">
            <Investor />
          </ProtectedRoute>
        }
      />
      {/* Wallet-required route - requires connected wallet */}
      <Route
        path="/wallet-required"
        element={
          <ProtectedRoute requireWallet={true}>
            <WalletRequired />
          </ProtectedRoute>
        }
      />
      {/* Cap Table route - displays all shareholders */}
      <Route
        path="/cap-table"
        element={
          <ProtectedRoute>
            <CapTable />
          </ProtectedRoute>
        }
      />
      {/* Approvals route - wallet approval dashboard for issuer/admin */}
      <Route
        path="/approvals"
        element={
          <ProtectedRoute>
            <Approvals />
          </ProtectedRoute>
        }
      />
      {/* API Test route - for testing API client integration */}
      <Route
        path="/api-test"
        element={
          <ProtectedRoute>
            <APITest />
          </ProtectedRoute>
        }
      />
      {/* Catch-all redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
