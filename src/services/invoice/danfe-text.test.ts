import { describe, expect, it } from 'vitest';
import { extractDanfeFields } from '~/services/invoice/danfe-text';

const KEY = '51260612345678000199660020000029327544100001'; // 44 dígitos
const spacedKey = (KEY.match(/.{1,4}/g) ?? []).join(' ');

const sample = `ENERGISA MATO GROSSO DISTRIBUIDORA S.A.
Conta de energia elétrica - DANF3e
Competência: 06/2026
Chave de acesso ${spacedKey}
Consumo 250 kWh
Tarifa de energia R$ 1,194080 kWh
Total a pagar R$ 301,02`;

describe('extractDanfeFields (DANF3e)', () => {
  const d = extractDanfeFields(sample);

  it('detecta a distribuidora', () => {
    expect(d.distribuidora).toBe('Energisa');
  });

  it('extrai a chave de acesso (44 dígitos)', () => {
    expect(d.accessKey).toBe(KEY);
    expect(d.accessKey).toHaveLength(44);
  });

  it('extrai competência e data de emissão', () => {
    expect(d.raw.competencia).toBe('06/2026');
    expect(d.issuedAt).toBe('2026-06-01');
  });

  it('extrai o preço por kWh', () => {
    expect(d.unitPriceKwh).toBeCloseTo(1.19408);
  });

  it('lê tarifa com ponto decimal (sem vírgula) sem multiplicar', () => {
    const dot = extractDanfeFields(sample.replace('1,194080', '0.712345'));
    expect(dot.unitPriceKwh).toBeCloseTo(0.712345);
  });

  it('extrai consumo e total crus', () => {
    expect(d.raw.consumoKwh).toBe('250');
    expect(d.raw.total).toBe('301,02');
  });

  it('retorna vazio para texto irreconhecível (ex.: PDF escaneado)', () => {
    const empty = extractDanfeFields('   ');
    expect(empty.distribuidora).toBeUndefined();
    expect(empty.accessKey).toBeUndefined();
  });
});
