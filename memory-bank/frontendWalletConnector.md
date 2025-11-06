# Frontend Wallet Connection Layer — ChainEquity / Keyvault

## Overview

Implements MetaMask wallet connectivity using **Wagmi v2**, **Viem**, and **React Query**.

This layer forms the bridge between the **frontend React app** and the **EVM-based contracts** in `contracts/`.

It's designed to be **self-contained, declarative, and chain-agnostic**.

---

## Core Dependencies

```json
{
  "wagmi": "latest",
  "viem": "latest",
  "@tanstack/react-query": "^5.51.18"
}
```

---

## Implementation Structure

### 1. `src/config.ts`

Defines supported networks and RPC transports.

```typescript
import { createConfig, http } from "wagmi";
import { astar, hardhat } from "wagmi/chains";

export const config = createConfig({
  chains: [hardhat, astar],
  transports: {
    [hardhat.id]: http(),
    [astar.id]: http(),
  },
  autoConnect: true,
});
```

**Notes:**
- Multi-chain ready; simply extend the `chains` array.
- `autoConnect: true` enables session persistence on refresh.
- For local development with Anvil, use `hardhat` chain (chainId: 31337) pointing to `http://127.0.0.1:8545`.

---

### 2. `src/provider.tsx`

Wraps the React app with Wagmi + React Query providers.

```typescript
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./config/wagmi";

// QueryClient created outside component for stability (important for React 19 + Wagmi v2)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Notes:**
- Every component beneath `Providers` can use Wagmi hooks.
- React Query handles wallet + contract query caching.
- **Important:** QueryClient must be created outside the component to ensure stability with React 19 and Wagmi v2 (prevents "Provider not found" errors).
- QueryClientProvider must be inside WagmiProvider (Wagmi v2 requirement).

**Usage in `main.tsx`:**
```typescript
import { Providers } from "./provider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Providers>
  </StrictMode>
);
```

---

### 3. `src/components/Connect.tsx`

Provides a comprehensive wallet connection UI for MetaMask (implemented in Task 4.4).

**Implementation Status:** ✅ Complete

**Features:**
- Connect/disconnect functionality using Wagmi hooks
- Address display with truncation (`0x1234...5678`)
- Connection status indicators (connected/disconnected/error)
- Loading states during connection
- Error handling with user-friendly messages
- Reconnect handling
- Light/dark mode support

**Key Implementation Details:**
```typescript
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function Connect() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // Uses injected connector (MetaMask) via connectors[0]
  // Formats address as: 0x1234...5678
  // Shows status: "Connecting…", "Connected", "Reconnecting…", or error messages
}
```

**Files:**
- `frontend/src/components/Connect.tsx` - Main component (refactored to use TailwindCSS + shadcn/ui)
- ~~`frontend/src/components/Connect.css`~~ - Removed (replaced with TailwindCSS utilities)

**Notes:**
- Wagmi automatically detects MetaMask via `window.ethereum`.
- No custom connectors or external wallet SDKs needed.
- Uses injected connector (first available connector from Wagmi).
- Integrated into `App.tsx` in prominent location.
- **Updated (Task 4.4b):** Now uses shadcn/ui Card and Button components with TailwindCSS utilities.
- **Dark mode:** Enabled by default via `class="dark"` on `<html>` element in `index.html`.
- **Provider fix:** QueryClient is created outside component to ensure stability with React 19 and Wagmi v2.

---

### 4. `src/WalletConnector.tsx` (optional)

Encapsulates connector button rendering (icon + label) for reuse in design system.

```typescript
import { Connector } from "wagmi";

interface WalletConnectorProps {
  connector: Connector;
  onClick: () => void;
}

export function WalletConnector({ connector, onClick }: WalletConnectorProps) {
  return (
    <button onClick={onClick}>
      <img src={connector.icon} alt={connector.name} />
      {connector.name}
    </button>
  );
}
```

---

## How It Works

1. Wagmi detects injected wallets (e.g. MetaMask).
2. `useConnect()` exposes available connectors.
3. `Connect.tsx` filters to `"io.metamask"`.
4. `connect({ connector })` triggers MetaMask's connection flow.
5. `useAccount()` exposes connection state + address.

---

## Integration into ChainEquity

### Frontend Contract Interactions

The frontend uses this layer for all wallet sessions and contract interactions.

**Example: Contract Write Operation**

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { abi } from "@chain-equity/contracts/artifacts/contracts/ChainEquityToken.sol/ChainEquityToken.json";

export function TransferButton({ to, amount }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  return (
    <button
      disabled={isPending || isLoading}
      onClick={() =>
        writeContract({
          address: "0xYourTokenAddress",
          abi,
          functionName: "transfer",
          args: [to, amount],
        })
      }
    >
      {isPending ? "Confirming..." : isSuccess ? "Transferred!" : "Transfer"}
    </button>
  );
}
```

**Example: Contract Read Operation**

```typescript
import { useReadContract } from "wagmi";
import { abi } from "@chain-equity/contracts/artifacts/contracts/ChainEquityToken.sol/ChainEquityToken.json";

export function BalanceDisplay({ address }) {
  const { data: balance, isLoading } = useReadContract({
    address: "0xYourTokenAddress",
    abi,
    functionName: "balanceOf",
    args: [address],
  });

  if (isLoading) return <span>Loading...</span>;
  return <span>Balance: {balance?.toString()}</span>;
}
```

### Operator Dashboard Operations

For issuer/admin operations, the frontend can call:

```typescript
// Approve wallet
writeContract({
  address: tokenAddress,
  abi,
  functionName: "approveWallet",
  args: [walletAddress],
});

// Mint tokens
writeContract({
  address: tokenAddress,
  abi,
  functionName: "mint",
  args: [toAddress, amount],
});

// Execute stock split
writeContract({
  address: tokenAddress,
  abi,
  functionName: "executeSplit",
  args: [multiplier], // e.g., 7e18 for 7-for-1 split
});

// Change symbol
writeContract({
  address: tokenAddress,
  abi,
  functionName: "changeSymbol",
  args: [newSymbol],
});
```

### Backend Integration

* **Backend** does *not* manage wallets directly — instead, it can authenticate users via [Sign-In With Ethereum (SIWE)](https://login.xyz/).
* **Contracts** are invoked through `useWriteContract()` or `writeContract()` using ABIs from contract artifacts.
* Frontend sends signed transactions directly to the blockchain via wallet.
* Backend indexes events and provides enriched data via REST API.

### File Structure

```
frontend/
 ├── src/
 │   ├── config/
 │   │   └── wagmi.ts        # Wagmi config (Task 4.3 ✅)
 │   ├── provider.tsx         # Providers wrapper (Task 4.3 ✅)
 │   ├── components/
 │   │   ├── Connect.tsx      # Wallet connection UI (Task 4.4 ✅)
 │   │   └── ui/              # shadcn/ui components (Task 4.4b ✅)
 │   │       ├── button.tsx
 │   │       ├── card.tsx
 │   │       ├── input.tsx
 │   │       ├── form.tsx
 │   │       └── label.tsx
 │   ├── lib/
 │   │   ├── utils.ts         # Tailwind className utilities (Task 4.4b ✅)
 │   │   └── wallet/          # Wallet-related utilities (future)
 │   │       └── hooks.ts     # Custom hooks for contract interactions (future)
 │   └── features/
 │       └── auth/            # Authentication components (future)
```

---

## Best Practices

### ✅ Do

- Use `autoConnect: true` for seamless sessions across page refreshes.
- Include `useSwitchChain()` if multiple networks are supported.
- Scope wallet UI under `frontend/src/lib/wallet/` or `frontend/src/features/auth/`.
- Integrate with backend auth (SIWE) for secure "wallet-as-login."
- Use `useWaitForTransactionReceipt()` to track transaction status.
- Extract contract interaction logic into custom hooks for reusability.

### 🚫 Don't

- Avoid directly calling `window.ethereum` — Wagmi handles detection safely.
- Don't create custom connectors unless necessary — Wagmi auto-detects injected wallets.
- Don't skip React Query — it's required by Wagmi v2 for state management.
- Don't hardcode contract addresses — use environment variables or config.

---

## Chain Switching

For multi-chain support, use `useSwitchChain()`:

```typescript
import { useSwitchChain, useChainId } from "wagmi";

export function ChainSwitcher() {
  const chainId = useChainId();
  const { chains, switchChain } = useSwitchChain();

  return (
    <select
      value={chainId}
      onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
    >
      {chains.map((chain) => (
        <option key={chain.id} value={chain.id}>
          {chain.name}
        </option>
      ))}
    </select>
  );
}
```

---

## Summary

| Feature                 | Status                         |
| ----------------------- | ------------------------------ |
| MetaMask Detection      | ✅ Built-in via Wagmi           |
| Multi-chain Support     | ✅ (Hardhat + Sepolia)          |
| Declarative React Hooks | ✅                              |
| State Caching           | ✅ via React Query              |
| Session Persistence     | ✅ via autoConnect              |
| Wallet Connection UI    | ✅ Task 4.4 Complete           |
| Custom Wallet Logic     | ❌ Not required                 |
| Integration Points      | Contracts ↔ Backend ↔ Frontend |

---

## Key Design Principles

1. **Declarative**: Use React hooks, not imperative wallet calls
2. **Chain-Agnostic**: Easily add new chains via config
3. **Reactive**: React Query provides automatic cache invalidation
4. **Self-Contained**: Wallet logic isolated in dedicated modules
5. **AI-First**: Modular architecture aligns with AI-assisted development

---

## Implementation Status

✅ **Completed (Task 4.1-4.4b):**
1. ✅ Installed dependencies: `wagmi`, `viem`, `@tanstack/react-query`
2. ✅ Created `src/config/wagmi.ts` with chain configuration (Hardhat + Sepolia)
3. ✅ Created `src/provider.tsx` with WagmiProvider wrapper (fixed for React 19 compatibility)
4. ✅ Created `src/components/Connect.tsx` for wallet connection UI
5. ✅ Migrated to TailwindCSS + shadcn/ui (Task 4.4b)
   - Removed `src/components/Connect.css` (now using Tailwind utilities)
   - Refactored Connect.tsx to use shadcn/ui Card and Button components
6. ✅ Enabled dark mode by default (`class="dark"` on `<html>` element)
7. ✅ Wrapped app with `Providers` in `main.tsx`
8. ✅ Integrated Connect component into `App.tsx`

⏳ **To Implement (Future Tasks):**
- Use Wagmi hooks (`useWriteContract`, `useReadContract`) for contract interactions
- Import contract ABIs from `contracts/exports/abis/`
- Create custom hooks for contract operations
- Implement contract write operations (transfer, mint, etc.)

---

## Notes

- This setup turns the wallet into a **reactive session manager**, aligning perfectly with the **AI-first, modular architecture** of ChainEquity.
- The frontend stays declarative, the backend stays chain-agnostic, and the contracts remain the canonical source of truth.
- For local development with Anvil, ensure MetaMask is configured to connect to `localhost:8545` with chain ID `31337`.
