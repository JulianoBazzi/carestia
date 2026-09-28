import { describe, expect, it } from 'vitest';
import { safeNextPath } from '~/lib/auth/next-path';

describe('safeNextPath', () => {
  it('aceita caminho relativo com query', () => {
    expect(safeNextPath('?next=%2Fscanner%3Ftab%3Dlabel')).toBe('/scanner?tab=label');
  });

  it('devolve null sem next', () => {
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath('?x=1')).toBeNull();
  });

  it('rejeita redirecionamentos externos', () => {
    expect(safeNextPath('?next=https://evil.com')).toBeNull();
    expect(safeNextPath('?next=//evil.com')).toBeNull();
    expect(safeNextPath('?next=/\\evil.com')).toBeNull();
    expect(safeNextPath('?next=javascript:alert(1)')).toBeNull();
  });

  it('rejeita caracteres de controle que o navegador descartaria', () => {
    expect(safeNextPath('?next=/%09/evil.com')).toBeNull();
    expect(safeNextPath('?next=/%0A/evil.com')).toBeNull();
    expect(safeNextPath('?next=/%0D%0A/evil.com')).toBeNull();
  });
});
