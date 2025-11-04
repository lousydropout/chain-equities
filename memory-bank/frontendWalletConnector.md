# Frontend Wallet Connection Implementation

## Overview

Reference implementation for connecting MetaMask wallet using Wagmi v2. This will be used when building the operator UI/dashboard for ChainEquity.

## Key Dependencies

```json
{
  "wagmi": "latest",
  "viem": "latest",
  "@tanstack/react-query": "^5.51.18"
}
```

## Implementation Structure

### 1. Wagmi Configuration (`src/config.ts`)

Creates a Wagmi config with supported chains (Hardhat, Astar, or Anvil for local dev).

```typescript
import { createConfig, http } from "wagmi";
import { astar, hardhat } from "wagmi/chains";

export const config = createConfig({
  chains: [hardhat, astar],
  transports: {
    [hardhat.id]: http(),
    [astar.id]: http(),
  },
});
```

For ChainEquity local development:
- Use `hardhat` chain (or custom Anvil chain config)
- HTTP transport pointing to `http://127.0.0.1:8545` for Anvil

### 2. Provider Setup (`src/provider.tsx`)

Wraps the app with `WagmiProvider` and `QueryClientProvider`.

```typescript
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function Web3ModalProvider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### 3. Connection Component (`src/Connect.tsx`)

Uses `useConnect()`, `useAccount()`, and `useDisconnect()` hooks.

```typescript
import { useAccount, useConnect, useDisconnect } from "wagmi";

const allowedWallets = new Set(["io.metamask"]);

export const Connect = () => {
  const account = useAccount();
  const { connectors, connect: walletConnect } = useConnect();
  const { disconnect } = useDisconnect();

  // Filter and connect logic
  connectors
    .filter((connector) => allowedWallets.has(connector.id))
    .map((connector) => (
      <WalletConnector
        connector={connector}
        onClick={() => walletConnect({ connector })}
      />
    ));
};
```

### 4. Wallet Connector UI (`src/WalletConnector.tsx`)

Renders a button per connector with icon and name.

## How It Works

1. Wagmi detects MetaMask via `window.ethereum` when available
2. `useConnect()` exposes connectors, including MetaMask (`id: "io.metamask"`)
3. Filtering limits UI to MetaMask only
4. `connect()` triggers MetaMask's connection flow
5. `useAccount()` provides connection status and account info

## Important Points

- **No explicit connector creation**: Wagmi auto-detects injected wallets
- **MetaMask ID**: `"io.metamask"`
- **No extra wallet libraries needed**: Wagmi handles detection
- **QueryClient**: Required by Wagmi v2 for state management
- **Multi-chain**: Config supports multiple chains; users can switch networks

## Integration with ChainEquity

### For Operator UI

The operator dashboard will need:
1. Wallet connection for issuer/admin operations
2. Display of connected account address
3. Chain switching (Anvil local dev → testnet)
4. Transaction signing for:
   - `approveWallet()`
   - `mint()`
   - `executeSplit()`
   - `changeSymbol()`

### Suggested Implementation

```typescript
// OperatorDashboard.tsx
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { abi } from "../artifacts/ChainEquityToken.json";

export function OperatorDashboard() {
  const account = useAccount();
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approveWallet = (wallet: string) => {
    writeContract({
      address: tokenAddress,
      abi,
      functionName: "approveWallet",
      args: [wallet],
    });
  };

  // ... other operations
}
```

## To Replicate

1. Install: `wagmi`, `viem`, `@tanstack/react-query`
2. Create a Wagmi config with your chains (include Anvil for local dev)
3. Wrap the app with `WagmiProvider` and `QueryClientProvider`
4. Use `useConnect()` to get connectors
5. Filter for `"io.metamask"` if only showing MetaMask
6. Call `connect({ connector })` to connect
7. Use `useAccount()` for connection state and account info
8. Use `useWriteContract()` and `useWaitForTransactionReceipt()` for contract interactions

## Notes

- This approach is declarative and relies on Wagmi's built-in wallet detection
- For local development with Anvil, ensure MetaMask is configured to connect to localhost:8545
- Chain ID for Anvil: 31337 (default)

