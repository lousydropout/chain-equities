/**
 * @file Database schema definitions for ChainEquity backend
 * @notice SQLite schema compatible with PostgreSQL for future migration
 */

/**
 * SQL schema for users table
 * Stores user authentication and role information
 */
export const USERS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    wallet_address TEXT,
    role TEXT CHECK(role IN ('admin', 'issuer', 'investor')) NOT NULL DEFAULT 'investor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address) WHERE wallet_address IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
`;

/**
 * User record interface matching database schema
 */
export interface UserRecord {
  uid: string;
  email: string;
  display_name: string | null;
  wallet_address: string | null;
  role: 'admin' | 'issuer' | 'investor';
  created_at: string; // ISO timestamp string
}

/**
 * Input type for creating a new user
 */
export interface CreateUserInput {
  uid: string;
  email: string;
  display_name?: string;
  role?: 'admin' | 'issuer' | 'investor';
}

/**
 * Input type for updating a user
 */
export interface UpdateUserInput {
  display_name?: string;
  wallet_address?: string | null;
  role?: 'admin' | 'issuer' | 'investor';
}

