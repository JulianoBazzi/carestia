// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { infosimplesNfceSchema } from '~/schemas/infosimples';
import {
  parseAddressTail,
  parseInfosimplesNfce,
  parseMoney,
  toIsoDateTime,
} from '~/services/invoice/infosimples-nfce';

const raw = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__/infosimples-nfce.json'), 'utf-8'),
);

/** `data[0]` real de uma NFC-e de MT (PII removida da fixture). */
function fixture() {
  return infosimplesNfceSchema.parse(raw);
}

describe('parseMoney', () => {
  it('converte decimal pt-BR', () => {
    expect(parseMoney('43,92')).toBe('43.92');
    expect(parseMoney('0,69')).toBe('0.69');
  });

  it('trata o ponto como milhar quando há vírgula', () => {
    expect(parseMoney('1.234,56')).toBe('1234.56');
  });

  it('aceita ponto como decimal quando NÃO há vírgula (outras UFs)', () => {
    expect(parseMoney('43.92')).toBe('43.92');
    expect(parseMoney('7')).toBe('7');
  });

  it('cai no valor normalizado quando a string é o literal "NaN"', () => {
    // A API realmente emite "NaN" (visto em formas_pagamento).
    expect(parseMoney('NaN', 12.5)).toBe('12.5');
  });

  it('cai no valor normalizado quando a string está ausente', () => {
    expect(parseMoney(null, 3.5)).toBe('3.5');
    expect(parseMoney(undefined, 3.5)).toBe('3.5');
  });

  it('devolve "0" quando não há string nem fallback utilizável', () => {
    expect(parseMoney(null)).toBe('0');
    expect(parseMoney('NaN', Number.NaN)).toBe('0');
    expect(parseMoney('R$ 10,00')).toBe('0');
  });
});

describe('toIsoDateTime', () => {
  it('monta a data no fuso de Brasília', () => {
    expect(toIsoDateTime('26/07/2026', '13:33:12')).toBe('2026-07-26T13:33:12-03:00');
  });

  it('completa os segundos quando só vem hh:mm', () => {
    expect(toIsoDateTime('26/07/2026', '13:33')).toBe('2026-07-26T13:33:00-03:00');
  });

  it('usa meio-dia quando não há hora usável (não escorrega de mês)', () => {
    expect(toIsoDateTime('01/08/2026', null)).toBe('2026-08-01T12:00:00-03:00');
    expect(toIsoDateTime('01/08/2026', 'NaN')).toBe('2026-08-01T12:00:00-03:00');
  });

  it('lança quando a data está ausente ou em outro formato', () => {
    expect(() => toIsoDateTime(null, '13:00:00')).toThrow(/Data de emissão/);
    expect(() => toIsoDateTime('2026-07-26', '13:00:00')).toThrow(/Data de emissão/);
  });
});

describe('parseAddressTail', () => {
  it('extrai bairro/cidade/UF da cauda do endereço', () => {
    expect(
      parseAddressTail(
        'RUA FERNANDO CORREA DA COSTA, LOJA 01 , 478 , NAO INFORMADO , VILA AURORA , RONDONOPOLIS , MT',
      ),
    ).toEqual({ neighborhood: 'VILA AURORA', city: 'RONDONOPOLIS', state: 'MT' });
  });

  it('descarta placeholders no lugar do bairro', () => {
    expect(parseAddressTail('RUA X , 100 , NAO INFORMADO , CUIABA , MT')).toEqual({
      neighborhood: undefined,
      city: 'CUIABA',
      state: 'MT',
    });
  });

  it('devolve vazio quando o último segmento não é UF (cai no fallback BrasilAPI)', () => {
    expect(parseAddressTail('RUA X , 100 , CENTRO , RONDONOPOLIS , BRASIL')).toEqual({});
    expect(parseAddressTail('RUA X , 100')).toEqual({});
    expect(parseAddressTail(null)).toEqual({});
  });
});

describe('parseInfosimplesNfce', () => {
  it('mapeia emitente, nota e itens da NFC-e real', () => {
    const parsed = parseInfosimplesNfce(fixture());

    expect(parsed.company).toEqual({
      document: '05931411000629',
      socialName: 'COMPACTA COMERCIAL LTDA',
      neighborhood: 'VILA AURORA',
      city: 'RONDONOPOLIS',
      state: 'MT',
    });

    expect(parsed.invoice).toMatchObject({
      model: 'nfce',
      number: '198493',
      series: '529',
      // Chave sem os espaços do portal da SEFAZ.
      accessKey: '51260705931411000629655290001984931400716910',
      issuedAt: '2026-07-26T13:33:12-03:00',
    });
  });

  it('preserva o preço unitário a partir da string pt-BR', () => {
    const parsed = parseInfosimplesNfce(fixture());
    expect(parsed.items.map((i) => i.unitValue)).toEqual(['0.69', '7.29', '9.99', '9.99', '43.92']);
    expect(parsed.items.map((i) => i.unit)).toEqual(['UN', 'UN', 'UN', 'UN', 'CX']);
  });

  it('deixa o item sem NCM e sem EAN (a NFC-e não expõe nenhum dos dois)', () => {
    const parsed = parseInfosimplesNfce(fixture());
    for (const item of parsed.items) {
      expect(item.type).toBe('product');
      expect(item.referenceCode).toBe('');
      expect(item.ean).toBeUndefined();
    }
  });

  it('mantém as linhas repetidas (o dedupe é do importInvoice)', () => {
    const parsed = parseInfosimplesNfce(fixture());
    const erva = parsed.items.filter((i) => i.name.startsWith('ERVA TERERE'));
    expect(erva).toHaveLength(2);
  });

  it('lança quando a chave de acesso não tem 44 dígitos', () => {
    const broken = fixture();
    broken.informacoes_nota.chave_acesso = '1234';
    expect(() => parseInfosimplesNfce(broken)).toThrow(/Chave de acesso/);
  });
});
