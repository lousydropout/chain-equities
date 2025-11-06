/**
 * @file User database operations for ChainEquity backend
 * @notice Handles CRUD operations for users table with role management
 * 
 * @dev Database utilities for user management.
 *      Implemented and typed, but not currently exposed via API in demo mode.
 *      To be connected post-demo (see Tasks 3.3 & 3.4).
 */

import { Database } from "bun:sqlite";
import type {
  UserRecord,
  CreateUserInput,
  UpdateUserInput,
} from "../../db/schema";
import type { UserRole } from "../../types/roles";

/**
 * Create a new user in the database
 * @param db SQLite database instance
 * @param input User creation data
 * @returns Created user record
 */
export function createUser(db: Database, input: CreateUserInput): UserRecord {
  const { uid, email, displayName, role = "investor" } = input;

  const stmt = db.prepare(`
    INSERT INTO users (uid, email, display_name, role)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `);

  const result = stmt.get(uid, email, displayName || null, role) as UserRecord;
  return result;
}

/**
 * Get user by Firebase UID
 * @param db SQLite database instance
 * @param uid Firebase user UID
 * @returns User record or null if not found
 */
export function getUserByUid(db: Database, uid: string): UserRecord | null {
  const stmt = db.prepare("SELECT * FROM users WHERE uid = ?");
  const result = stmt.get(uid) as UserRecord | undefined;
  return result || null;
}

/**
 * Get user by email address
 * @param db SQLite database instance
 * @param email User email address
 * @returns User record or null if not found
 */
export function getUserByEmail(db: Database, email: string): UserRecord | null {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const result = stmt.get(email) as UserRecord | undefined;
  return result || null;
}

/**
 * Get user by linked wallet address
 * @param db SQLite database instance
 * @param walletAddress Ethereum wallet address
 * @returns User record or null if not found
 */
export function getUserByWallet(
  db: Database,
  walletAddress: string
): UserRecord | null {
  const stmt = db.prepare("SELECT * FROM users WHERE wallet_address = ?");
  const result = stmt.get(walletAddress.toLowerCase()) as
    | UserRecord
    | undefined;
  return result || null;
}

/**
 * Update user information
 * @param db SQLite database instance
 * @param uid Firebase user UID
 * @param input Update data
 * @returns Updated user record or null if not found
 */
export function updateUser(
  db: Database,
  uid: string,
  input: UpdateUserInput
): UserRecord | null {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.displayName !== undefined) {
    updates.push("display_name = ?");
    values.push(input.displayName);
  }

  if (input.walletAddress !== undefined) {
    updates.push("wallet_address = ?");
    values.push(input.walletAddress ? input.walletAddress.toLowerCase() : null);
  }

  if (input.role !== undefined) {
    updates.push("role = ?");
    values.push(input.role);
  }

  if (updates.length === 0) {
    // No updates, just return current user
    return getUserByUid(db, uid);
  }

  values.push(uid);

  const stmt = db.prepare(`
    UPDATE users
    SET ${updates.join(", ")}
    WHERE uid = ?
    RETURNING *
  `);

  const result = stmt.get(...values) as UserRecord | undefined;
  return result || null;
}

/**
 * Update user role (typically admin-only operation)
 * @param db SQLite database instance
 * @param uid Firebase user UID
 * @param role New role to assign
 * @returns Updated user record or null if not found
 */
export function updateUserRole(
  db: Database,
  uid: string,
  role: UserRole
): UserRecord | null {
  return updateUser(db, uid, { role });
}

/**
 * Link wallet address to user
 * @param db SQLite database instance
 * @param uid Firebase user UID
 * @param walletAddress Ethereum wallet address to link
 * @returns Updated user record or null if not found
 */
export function linkWallet(
  db: Database,
  uid: string,
  walletAddress: string
): UserRecord | null {
  return updateUser(db, uid, { walletAddress: walletAddress });
}

/**
 * Unlink wallet address from user
 * @param db SQLite database instance
 * @param uid Firebase user UID
 * @returns Updated user record or null if not found
 */
export function unlinkWallet(db: Database, uid: string): UserRecord | null {
  return updateUser(db, uid, { walletAddress: null });
}

/**
 * Get all users with linked wallets
 * @param db SQLite database instance
 * @param role Optional role filter (e.g., 'investor' to get only investors)
 * @returns Array of user records with linked wallets
 */
export function getUsersWithLinkedWallets(
  db: Database,
  role?: UserRole
): UserRecord[] {
  let query = "SELECT * FROM users WHERE wallet_address IS NOT NULL";
  const params: unknown[] = [];
  
  if (role) {
    query += " AND role = ?";
    params.push(role);
  }
  
  query += " ORDER BY email ASC";
  
  const stmt = db.prepare(query);
  const results = stmt.all(...params) as unknown[];
  
  return results.map((row) => {
    const r = row as {
      uid: string;
      email: string;
      display_name: string | null;
      wallet_address: string | null;
      role: string;
      created_at: string;
    };
    return {
      uid: r.uid,
      email: r.email,
      displayName: r.display_name,
      walletAddress: r.wallet_address ? String(r.wallet_address) : null,
      role: r.role as UserRole,
      createdAt: r.created_at,
    };
  });
}
