/**
 * @file Authentication utilities for ChainEquity frontend
 * @notice Demo mode: Mock token helpers for API integration
 *
 * @note Post-Demo: These will be replaced with real JWT token management
 */

/**
 * Storage key for auth token in localStorage
 */
const AUTH_TOKEN_KEY = 'chain-equity-auth-token';

/**
 * Get auth token from localStorage
 * @returns Auth token string or null if not found
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Set auth token in localStorage
 * @param token - Auth token string to store
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Remove auth token from localStorage
 */
export function removeAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Storage key for auth user in localStorage
 */
const AUTH_USER_KEY = 'chain-equity-auth-user';

/**
 * Get auth user from localStorage
 * @returns Auth user JSON string or null if not found
 */
export function getAuthUser(): string | null {
  return localStorage.getItem(AUTH_USER_KEY);
}

/**
 * Set auth user in localStorage
 * @param user - Auth user JSON string to store
 */
export function setAuthUser(user: string): void {
  localStorage.setItem(AUTH_USER_KEY, user);
}

/**
 * Remove auth user from localStorage
 */
export function removeAuthUser(): void {
  localStorage.removeItem(AUTH_USER_KEY);
}
