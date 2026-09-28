import { describe, expect, it } from 'vitest';
import { accessKeyModel, extractAccessKey, isValidAccessKey } from '~/lib/access-key';

// Chave NFC-e (modelo 65) com DV válido (as fixtures do projeto não validam DV).
const NFCE_KEY = '65260612345678000199650010000000011000000010';
// Chave NF-e (modelo 55) com DV válido.
const NFE_KEY = '43200612345678000199550010000000011000000019';

describe('isValidAccessKey', () => {
  it('aceita chaves com DV correto', () => {
    expect(isValidAccessKey(NFCE_KEY)).toBe(true);
  });

  it('rejeita DV errado, tamanho errado e não-dígitos', () => {
    expect(isValidAccessKey(`${NFCE_KEY.slice(0, 43)}9`)).toBe(false);
    expect(isValidAccessKey(NFCE_KEY.slice(0, 43))).toBe(false);
    expect(isValidAccessKey(`${NFCE_KEY.slice(0, 43)}x`)).toBe(false);
  });
});

describe('accessKeyModel', () => {
  it('lê os dígitos 21–22', () => {
    expect(accessKeyModel(NFCE_KEY)).toBe('65');
  });
});

describe('extractAccessKey', () => {
  it('extrai do QR v2 da NFC-e (parâmetro p com pipes)', () => {
    const url = `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${NFCE_KEY}|2|1|1|ABCDEF0123456789`;
    expect(extractAccessKey(url)).toEqual({ key: NFCE_KEY });
  });

  it('extrai do QR legado (chNFe=)', () => {
    const url = `https://nfce.fazenda.sp.gov.br/qrcode?chNFe=${NFCE_KEY}&nVersao=100&tpAmb=1`;
    expect(extractAccessKey(url)).toEqual({ key: NFCE_KEY });
  });

  it('aceita os 44 dígitos puros e com espaços de agrupamento', () => {
    expect(extractAccessKey(NFCE_KEY)).toEqual({ key: NFCE_KEY });
    const grouped = NFCE_KEY.replace(/(\d{4})(?=\d)/g, '$1 ');
    expect(extractAccessKey(` ${grouped} `)).toEqual({ key: NFCE_KEY });
  });

  it('erra com mensagem quando não há 44 dígitos', () => {
    expect(extractAccessKey('https://exemplo.com/produto/123')).toMatchObject({
      error: expect.stringContaining('44 dígitos'),
    });
  });

  it('erra quando o DV não confere', () => {
    expect(extractAccessKey(`${NFCE_KEY.slice(0, 43)}9`)).toMatchObject({
      error: expect.stringContaining('dígito verificador'),
    });
  });

  it('rejeita modelos que não sejam 55/65', () => {
    // Troca o modelo para 57 (CT-e) e recalcula um DV válido por força bruta.
    const base = `${NFCE_KEY.slice(0, 20)}57${NFCE_KEY.slice(22, 43)}`;
    const withDv = Array.from({ length: 10 }, (_, d) => `${base}${d}`).find(isValidAccessKey);
    expect(withDv).toBeDefined();
    expect(extractAccessKey(withDv as string)).toMatchObject({
      error: expect.stringContaining('NF-e/NFC-e'),
    });
  });

  it('aceita NF-e (modelo 55)', () => {
    expect(extractAccessKey(NFE_KEY)).toEqual({ key: NFE_KEY });
  });
});
