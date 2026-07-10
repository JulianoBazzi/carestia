// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { matchKey, normalizeName, toUpperLive } from '~/lib/normalize';

describe('toUpperLive', () => {
  it('coloca em maiúscula e remove acento (sem trim/colapso, para digitação)', () => {
    expect(toUpperLive('são paulo')).toBe('SAO PAULO');
    expect(toUpperLive('açaí')).toBe('ACAI');
  });

  it('preserva espaços do usuário (não faz trim nem colapsa)', () => {
    expect(toUpperLive('rua  a ')).toBe('RUA  A ');
    expect(toUpperLive(' ')).toBe(' ');
  });

  it('é inócuo em conteúdo numérico', () => {
    expect(toUpperLive('12,50')).toBe('12,50');
    expect(toUpperLive('00.000.000/0000-00')).toBe('00.000.000/0000-00');
  });

  it('lida com string vazia', () => {
    expect(toUpperLive('')).toBe('');
  });
});

describe('normalizeName (fonte da verdade no submit)', () => {
  it('maiúscula + sem acento + colapsa espaços + trim', () => {
    expect(normalizeName('  são   josé  ')).toBe('SAO JOSE');
    expect(normalizeName('kWh')).toBe('KWH');
  });

  it('retorna undefined para vazio/nulo', () => {
    expect(normalizeName('')).toBeUndefined();
    expect(normalizeName(null)).toBeUndefined();
    expect(normalizeName('   ')).toBeUndefined();
  });
});

describe('matchKey', () => {
  it('remove pontuação para o casamento de itens', () => {
    expect(matchKey('Diesel S-10.')).toBe('DIESEL S10');
  });
});
