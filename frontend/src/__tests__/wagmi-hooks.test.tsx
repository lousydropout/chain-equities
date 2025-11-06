/**
 * @file Test to verify Wagmi hooks are accessible
 * @notice Tests that common Wagmi hooks can be imported
 */

import { describe, it, expect } from 'bun:test';

describe('Wagmi Hooks Accessibility', () => {
  it('should be able to import useAccount hook', async () => {
    const { useAccount } = await import('wagmi');
    expect(useAccount).toBeDefined();
    expect(typeof useAccount).toBe('function');
  });

  it('should be able to import useConnect hook', async () => {
    const { useConnect } = await import('wagmi');
    expect(useConnect).toBeDefined();
    expect(typeof useConnect).toBe('function');
  });

  it('should be able to import useDisconnect hook', async () => {
    const { useDisconnect } = await import('wagmi');
    expect(useDisconnect).toBeDefined();
    expect(typeof useDisconnect).toBe('function');
  });

  it('should be able to import useChainId hook', async () => {
    const { useChainId } = await import('wagmi');
    expect(useChainId).toBeDefined();
    expect(typeof useChainId).toBe('function');
  });
});

