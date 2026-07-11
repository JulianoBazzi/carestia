// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isAdmin } from '~/lib/auth/admin';

describe('isAdmin', () => {
  it('true quando type = admin', () => {
    expect(isAdmin({ type: 'admin' })).toBe(true);
  });

  it('false quando type = user', () => {
    expect(isAdmin({ type: 'user' })).toBe(false);
  });

  it('false para sessão ausente ou type indefinido', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin({})).toBe(false);
    expect(isAdmin({ type: null })).toBe(false);
  });
});
