# Authentication Architecture — ChainEquity

## Overview

ChainEquity uses **Firebase Authentication (email + password)** as the **primary** identity layer.
Blockchain wallets (via Wagmi + MetaMask) are used **secondarily**, to verify asset ownership or authorize on-chain actions.

This hybrid model aligns with enterprise needs:
legal shareholders are tracked by verified emails, while blockchain operations still rely on cryptographic proofs.

---

## Rationale

| Requirement             | Why Firebase Auth Fits                                     |
| ----------------------- | ---------------------------------------------------------- |
| Enterprise onboarding   | Companies already maintain shareholder emails.             |
| Legal compliance        | Email-based identities can be tied to KYC/AML records.     |
| Familiar UX             | Users expect email/password or SSO, not wallets.           |
| Multi-tenant management | Firebase handles org-level separation, roles, and invites. |
| Optional crypto linkage | Wallets can still sign for token transfers or votes.       |

Wallet-only auth (e.g., SIWE) is kept for open, trustless scenarios but is **not** used for general login.

---

## Authentication Flow

### 1. Primary Login (Firebase)

1. Users register or are invited via email.
2. Firebase issues an ID token (JWT).
3. The frontend attaches this JWT to every API request (`Authorization: Bearer <token>`).
4. Backend verifies the JWT using Firebase Admin SDK before processing requests.

### 2. Optional Wallet Linking

1. Logged-in users can link a blockchain wallet.
2. Backend issues a nonce and verifies a signed message (EIP-191).
3. Once verified, the wallet address is stored in the user profile (e.g. Firestore or Postgres).
4. Linked address can then be used for signing transactions or verifying share ownership.

---

## Example Data Model

### SQL Schema (Postgres)

```sql
CREATE TABLE users (
  uid TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  wallet_address TEXT,
  role TEXT CHECK(role IN ('admin','issuer','investor')),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address) WHERE wallet_address IS NOT NULL;
```

### Firestore Alternative

```javascript
users/{uid} = {
  email: string,
  displayName: string,
  walletAddress: string | null,
  role: 'admin' | 'issuer' | 'investor',
  createdAt: Timestamp
}
```

---

## Frontend Integration

### Firebase Auth Setup

```typescript
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Primary Login

```typescript
import { signInWithEmailAndPassword, getAuth } from "firebase/auth";

const auth = getAuth();
await signInWithEmailAndPassword(auth, email, password);
const token = await auth.currentUser?.getIdToken();

// Attach to API requests
fetch("/api/companies", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### Optional Wallet Link

```typescript
import { signMessage } from "wagmi/actions";

const message = "Link wallet to ChainEquity";
const signature = await signMessage({ message });

await fetch("/api/link-wallet", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`, // Firebase JWT
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message, signature }),
});
```

### React Hook Example

```typescript
import { useAuthState } from "react-firebase-hooks/auth";
import { useAccount } from "wagmi";
import { auth } from "./config";

export function useUser() {
  const [user, loading, error] = useAuthState(auth);
  const account = useAccount();
  
  return {
    firebaseUser: user,
    walletAddress: account.address,
    isLinked: user?.walletAddress === account.address,
    loading,
    error,
  };
}
```

---

## Backend Verification

### Firebase Admin Setup

```typescript
// backend/src/services/firebase.ts
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Or use service account:
    // credential: admin.credential.cert({
    //   projectId: process.env.FIREBASE_PROJECT_ID,
    //   clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    //   privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    // }),
  });
}

export const auth = admin.auth();
```

---

## Unified Auth Middleware

### Purpose

Provide a single middleware that:

1. Verifies **Firebase Auth JWTs** to confirm user identity.
2. Checks **wallet authorization** (if required for the route).
3. Optionally verifies **role-based permissions** (e.g., admin, investor).

This ensures every API call is authenticated, scoped, and authorized before reaching business logic.

### Dependencies

```bash
bun add firebase-admin viem
```

### Middleware Implementation

**`backend/src/middleware/auth.ts`**

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "../services/firebase";
import { verifyMessage } from "viem";

export interface AuthContext {
  uid: string;
  email: string;
  role: string;
  wallet_address?: string;
}

// Extend FastifyRequest to include user context
declare module "fastify" {
  interface FastifyRequest {
    user?: AuthContext;
  }
}

/**
 * Unified authentication middleware for Fastify
 * - Verifies Firebase ID token
 * - Attaches decoded user info to request
 * - Adds user context to req.user
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header) {
      return reply.code(401).send({ error: "Missing Authorization header" });
    }

    const token = header.replace("Bearer ", "");
    const decoded = await auth.verifyIdToken(token);

    // Attach Firebase user context
    // Note: role and wallet_address should be fetched from database
    // For now, using custom claims or database lookup
    req.user = {
      uid: decoded.uid,
      email: decoded.email || "",
      role: decoded.role || "investor", // From custom claims or DB
      wallet_address: decoded.wallet_address, // From custom claims or DB
    } as AuthContext;
  } catch (err: any) {
    reply.code(401).send({ 
      error: "Unauthorized", 
      message: err.message 
    });
  }
}

/**
 * Optional wallet verification step for sensitive routes
 * e.g., issuing or transferring shares
 * Requires that the user has linked a wallet address
 */
export async function requireWalletSignature(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = req.body as { message?: string; signature?: `0x${string}` };
  const { message, signature } = body;
  const expectedAddress = req.user?.wallet_address;

  if (!expectedAddress) {
    return reply.code(400).send({ 
      error: "No wallet linked to this account" 
    });
  }

  if (!message || !signature) {
    return reply.code(400).send({ 
      error: "Missing message or signature" 
    });
  }

  try {
    const recovered = await verifyMessage({
      message,
      signature,
      address: expectedAddress as `0x${string}`,
    });

    if (!recovered) {
      return reply.code(403).send({ 
        error: "Invalid wallet signature" 
      });
    }
  } catch (err: any) {
    return reply.code(403).send({ 
      error: "Wallet signature verification failed",
      message: err.message 
    });
  }
}

/**
 * Role-based access control helper
 * Returns a middleware function that checks user role
 */
export function requireRole(role: string) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (req.user?.role !== role) {
      return reply.code(403).send({ 
        error: "Forbidden",
        message: `Requires ${role} role` 
      });
    }
  };
}

/**
 * Alternative: require any of multiple roles
 */
export function requireAnyRole(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return reply.code(403).send({ 
        error: "Forbidden",
        message: `Requires one of: ${roles.join(", ")}` 
      });
    }
  };
}
```

### Usage in Routes

**`backend/src/routes/companies.ts`**

```typescript
import { FastifyInstance } from "fastify";
import { requireAuth, requireWalletSignature, requireRole } from "../middleware/auth";

export async function companyRoutes(app: FastifyInstance) {
  // Public route with authentication
  app.get(
    "/api/companies",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const companies = await db.companies.listByUser(req.user!.uid);
      return { companies };
    }
  );

  // Protected route requiring wallet signature
  app.post(
    "/api/companies/:id/issue",
    { preHandler: [requireAuth, requireWalletSignature] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { to, amount } = req.body as { to: string; amount: string };

      // On-chain action example:
      await issueSharesToInvestor({ 
        companyId: id, 
        to, 
        amount: BigInt(amount) 
      });
      
      return { success: true };
    }
  );

  // Admin-only route
  app.post(
    "/api/admin/create-company",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (req, reply) => {
      const { name, symbol, totalAuthorized } = req.body as {
        name: string;
        symbol: string;
        totalAuthorized: string;
      };

      // Create company logic
      const company = await createCompany({
        name,
        symbol,
        totalAuthorized,
        issuerId: req.user!.uid,
      });

      return { company };
    }
  );

  // Issuer or admin route
  app.post(
    "/api/companies/:id/approve-wallet",
    { preHandler: [requireAuth, requireAnyRole(["admin", "issuer"])] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { walletAddress } = req.body as { walletAddress: string };

      // Approve wallet logic
      await approveWalletForCompany(id, walletAddress);
      
      return { success: true };
    }
  );
}
```

### End-to-End Flow

| Step | Action                                    | Responsible System  |
| ---- | ----------------------------------------- | ------------------- |
| 1    | User logs in via Firebase email/password  | Firebase            |
| 2    | JWT added to each API request             | Frontend            |
| 3    | Backend verifies JWT → adds `req.user`    | Middleware          |
| 4    | If required, verifies wallet signature     | Middleware          |
| 5    | If required, checks role permissions      | Middleware          |
| 6    | Executes route logic (issue shares, etc.) | Backend + Contracts |

### Middleware Composition

Fastify allows stacking multiple pre-handlers:

```typescript
// Example: Admin route with wallet verification
app.post(
  "/api/admin/issue-shares",
  { 
    preHandler: [
      requireAuth,              // 1. Verify Firebase JWT
      requireRole("admin"),     // 2. Check admin role
      requireWalletSignature,   // 3. Verify wallet signature
    ] 
  },
  issueSharesHandler
);
```

### User Context Enhancement

For better user context, fetch additional data from database:

```typescript
export async function requireAuthWithUser(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(req, reply); // First verify JWT
  
  if (req.user) {
    // Fetch additional user data from database
    const userData = await db.user.findByUid(req.user.uid);
    req.user = {
      ...req.user,
      role: userData.role,
      wallet_address: userData.wallet_address,
      // ... other user fields
    };
  }
}
```

### Wallet Linking Endpoint

```typescript
import { verifyMessage } from "viem";
import { FastifyInstance } from "fastify";

export async function linkWalletRoutes(app: FastifyInstance) {
  app.post(
    "/api/link-wallet",
    { preHandler: verifyFirebaseToken },
    async (request, reply) => {
      const { uid } = request.user; // From middleware
      const { message, signature } = request.body as {
        message: string;
        signature: `0x${string}`;
      };

      // Verify the signed message
      const address = await verifyMessage({
        message,
        signature,
      });

      // Store wallet address in user profile
      await db.user.update(uid, { wallet_address: address });

      reply.send({ ok: true, address });
    }
  );
}
```

---

## Access Control

| API Endpoint                | Auth Method                 | Description                                |
| --------------------------- | --------------------------- | ------------------------------------------ |
| `/api/login`                | Firebase email/password     | Obtain JWT                                 |
| `/api/register`             | Firebase email/password     | Create new user account                    |
| `/api/companies`            | Firebase JWT                | View list of companies                     |
| `/api/companies/:id`        | Firebase JWT                | View company details                       |
| `/api/companies/:id/issue`  | Firebase + wallet signature | Mint or transfer shares (requires wallet) |
| `/api/companies/:id/shareholders` | Firebase JWT            | Read cap table data                        |
| `/api/companies/:id/transactions` | Firebase JWT            | View transaction history                   |
| `/api/wallet/link`          | Firebase + signed message   | Associate wallet with user                 |
| `/api/wallet/unlink`        | Firebase JWT                | Remove wallet association                  |

### Role-Based Access Control

```typescript
export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { uid } = request.user;
    const user = await db.user.findByUid(uid);
    
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  };
}

// Usage
app.get(
  "/api/admin/companies",
  { preHandler: [verifyFirebaseToken, requireRole(["admin", "issuer"])] },
  async (request, reply) => {
    // Only admins and issuers can access
  }
);
```

---

## Security Notes

### ✅ Best Practices

- **All API endpoints** verify Firebase JWTs before executing.
- **Wallet binding** requires signed proof from the wallet owner (EIP-191).
- **Use HTTPS** in production; never accept unsigned addresses from the client.
- **Rotate JWTs** regularly and enforce session expiry.
- **Limit wallet operations** to verified email accounts.
- **Validate signatures server-side** using `viem.verifyMessage()`.
- **Store wallet addresses** in lowercase for consistency.
- **Rate limiting** on authentication endpoints to prevent abuse.

### 🚫 Anti-Patterns

- Don't trust client-provided wallet addresses without verification.
- Don't skip JWT verification on any authenticated endpoint.
- Don't store sensitive data in JWTs (use database lookups).
- Don't expose Firebase Admin SDK credentials in client code.
- Don't allow wallet linking without email verification.

---

## Integration with Wallet Layer

The wallet layer (Wagmi) remains separate from authentication:

1. **User logs in** via Firebase (email/password).
2. **User optionally links** wallet address via signed message.
3. **Wallet connection** (Wagmi) is used for:
   - Signing on-chain transactions
   - Verifying share ownership
   - Displaying wallet balance
4. **Backend verifies** both Firebase JWT and wallet signature for sensitive operations.

### Example: Issuing Shares

```typescript
// Frontend
async function issueShares(companyId: string, to: string, amount: bigint) {
  // 1. User must be logged in (Firebase)
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  // 2. User must have linked wallet
  const user = await fetch("/api/user", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

  if (!user.walletAddress) throw new Error("Wallet not linked");

  // 3. Sign transaction via Wagmi
  const { writeContract } = useWriteContract();
  await writeContract({
    address: companyTokenAddress,
    abi: chainEquityTokenABI,
    functionName: "mint",
    args: [to, amount],
  });

  // 4. Backend indexes the event and updates database
}
```

---

## Demo Mode - Mock Authentication

### Demo Users

For demo and testing purposes, the frontend includes predefined demo users that can be used to test role-based access control:

| Username | Email                    | Role     | Description                    |
| -------- | ------------------------- | -------- | ------------------------------ |
| admin    | admin@chainequity.com    | admin    | Deploys/manages cap table      |
| alice    | alice@chainequity.com    | investor | Investor shareholder           |
| bob      | bob@chainequity.com       | investor | Investor shareholder           |
| charlie  | charlie@chainequity.com   | investor | Investor shareholder           |

### Demo Login

In demo mode, users can log in by:

1. **Quick Login Buttons**: Click one of the quick login buttons on the login page
2. **Email/Username Entry**: Enter any of the usernames or email addresses in the login form

The demo users are defined in `frontend/src/types/auth.ts` in the `DEMO_USERS` constant. The `getDemoUser()` helper function allows lookup by username or email address.

### Demo Authentication Flow

1. User selects a demo user (via button or form entry)
2. Frontend calls `login(usernameOrEmail)` with the selected identifier
3. `AuthContext` uses `getDemoUser()` to find the matching user
4. User is set in context and persisted to localStorage
5. Protected routes can now check user role and access permissions

**Note**: Demo mode uses mock authentication. In production, this will be replaced with Firebase Authentication integration.

---

## Summary

| Layer         | Role                                  | Technology               |
| ------------- | ------------------------------------- | ------------------------ |
| **Frontend**  | Email login + optional wallet linking | Firebase + Wagmi         |
| **Backend**   | Unified auth middleware + API enforcement | Fastify + Firebase Admin + Viem |
| **Contracts** | Execute verified on-chain operations  | Viem / Hardhat           |
| **Database**  | Persist user ↔ wallet mappings        | Firestore / Postgres     |

### Unified Middleware Benefits

- ✅ **Single source of truth** for authentication logic
- ✅ **Composable middleware** for flexible route protection
- ✅ **Type-safe** user context via TypeScript interfaces
- ✅ **Clear separation** of concerns (auth vs. business logic)
- ✅ **Easy to extend** with additional checks (rate limiting, IP whitelisting, etc.)

---

## Key Takeaway

> **Email = legal identity; wallet = cryptographic authority.**
> 
> Firebase manages people. The blockchain enforces ownership.
> Together, they form a compliant, user-friendly foundation for ChainEquity's cap-table platform.

This hybrid approach provides:
- **Enterprise-ready** authentication with familiar UX
- **Legal compliance** through email-based identity
- **Blockchain security** through cryptographic wallet verification
- **Flexible access control** with role-based permissions
- **Seamless integration** between Firebase and Wagmi

