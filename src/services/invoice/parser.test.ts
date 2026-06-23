import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectType, parseXml } from '~/services/invoice/parser';

const fixtures = join(__dirname, '__fixtures__');
const nfe = readFileSync(join(fixtures, 'nfe.xml'), 'utf-8');
const nfse = readFileSync(join(fixtures, 'nfse.xml'), 'utf-8');
const nfce = readFileSync(join(fixtures, 'nfce.xml'), 'utf-8');

describe('detectType', () => {
  it('identifica NF-e', () => {
    expect(detectType(nfe)).toBe('nfe');
  });
  it('identifica NFS-e', () => {
    expect(detectType(nfse)).toBe('nfse');
  });
  it('identifica NFC-e (mod 65) como nfe', () => {
    expect(detectType(nfce)).toBe('nfe');
  });
  it('lança em XML desconhecido', () => {
    expect(() => detectType('<foo/>')).toThrow();
  });
});

describe('parseXml NFC-e (mod 65)', () => {
  const parsed = parseXml(nfce);

  it('extrai produto com NCM', () => {
    expect(parsed.invoice.model).toBe('nfe');
    expect(parsed.company.document).toBe('12345678000199');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].type).toBe('product');
    expect(parsed.items[0].referenceCode).toBe('10063021');
    expect(parsed.items[0].totalValue).toBe('51.80');
  });
});

describe('parseXml NF-e', () => {
  const parsed = parseXml(nfe);

  it('extrai empresa do emitente', () => {
    expect(parsed.company.document).toBe('02760668000677');
    expect(parsed.company.fantasyName).toBe('POSTO CIDADE');
    expect(parsed.company.state).toBe('MT');
  });

  it('extrai chave sem prefixo NFe', () => {
    expect(parsed.invoice.accessKey).toBe('51260602760668000677550010001165321018655643');
    expect(parsed.invoice.model).toBe('nfe');
    expect(parsed.invoice.totalValue).toBe('141.50');
  });

  it('extrai item produto com NCM como reference_code', () => {
    expect(parsed.items).toHaveLength(1);
    const item = parsed.items[0];
    expect(item.type).toBe('product');
    expect(item.referenceCode).toBe('22071090');
    expect(item.name).toBe('ALCOOL ETILICO HIDRATADO');
    expect(item.unit).toBe('L');
    expect(item.totalValue).toBe('141.50');
  });
});

describe('parseXml NFS-e', () => {
  const parsed = parseXml(nfse);

  it('extrai empresa do prestador', () => {
    expect(parsed.company.document).toBe('44092663000159');
    expect(parsed.company.socialName).toContain('JULIANO MEDEIROS BAZZI');
  });

  it('extrai nota de serviço', () => {
    expect(parsed.invoice.model).toBe('nfse');
    expect(parsed.invoice.number).toBe('204');
    expect(parsed.invoice.totalValue).toBe('60.00');
  });

  it('extrai item serviço com cTribNac como reference_code', () => {
    expect(parsed.items).toHaveLength(1);
    const item = parsed.items[0];
    expect(item.type).toBe('service');
    expect(item.referenceCode).toBe('010701');
    expect(item.nbsCode).toBe('115080000');
    expect(item.quantity).toBe('1');
    expect(item.totalValue).toBe('60.00');
  });
});
