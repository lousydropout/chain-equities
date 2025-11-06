/**
 * @file Provider component for Wagmi and React Query
 * @notice Wraps the app with WagmiProvider and QueryClientProvider
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './config/wagmi';
import type { ReactNode } from 'react';

/**
 * QueryClient instance with default options
 * Configured for optimal React Query behavior
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Providers component that wraps the app with Wagmi and React Query providers
 * @param children - React children to wrap
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

