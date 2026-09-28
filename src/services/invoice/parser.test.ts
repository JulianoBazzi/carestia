import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectType, parseXml } from '~/services/invoice/parser';

const fixtures = join(__dirname, '__fixtures__');
const nfe = readFileSync(join(fixtures, 'nfe.xml'), 'utf-8');
const nfse = readFileSync(join(fixtures, 'nfse.xml'), 'utf-8');
const nfce = readFileSync(join(fixtures, 'nfce.xml'), 'utf-8');

// NF3e (conta de energia, modelo 66): emitente = distribuidora, itens por cClass em kWh.
const nf3e = `<nf3eProc><NF3e><infNF3e Id="NF3e51260612345678000199660020000293275441000000017"><ide><mod>66</mod><serie>2</serie><nNF>029327544</nNF><dhEmi>2026-06-18T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>ENERGISA MATO GROSSO</xNome><enderEmit><xLgr>AV DISTRIB</xLgr><xMun>CUIABA</xMun><cMun>5103403</cMun><UF>MT</UF></enderEmit></emit><acessante><CPF>00000000000</CPF><enderAcessante><xLgr>RUA X</xLgr><xBairro>Centro</xBairro><xMun>Rondonopolis</xMun><cMun>5107602</cMun><UF>MT</UF></enderAcessante></acessante><det nItem="1"><detItem><cClass>0601000</cClass><uMed>kWh</uMed><qFaturada>250</qFaturada><vItem>298.52</vItem></detItem></det><det nItem="2"><detItem><cClass>0801000</cClass><uMed>UN</uMed><qFaturada>1</qFaturada><vItem>2.50</vItem></detItem></det><total><vNF>301.02</vNF></total></infNF3e></NF3e></nf3eProc>`;

describe('detectType', () => {
  it('identifica NF-e', () => {
    expect(detectType(nfe)).toBe('nfe');
  });
  it('identifica NFS-e', () => {
    expect(detectType(nfse)).toBe('nfse');
  });
  it('identifica NFC-e (mod 65) como nfce', () => {
    expect(detectType(nfce)).toBe('nfce');
  });
  it('identifica NF3e (mod 66) como nf3e', () => {
    expect(detectType(nf3e)).toBe('nf3e');
  });
  it('lança em XML desconhecido', () => {
    expect(() => detectType('<foo/>')).toThrow();
  });
});

describe('parseXml NFC-e (mod 65)', () => {
  const parsed = parseXml(nfce);

  it('extrai produto com NCM', () => {
    expect(parsed.invoice.model).toBe('nfce');
    expect(parsed.company.document).toBe('12345678000199');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].type).toBe('product');
    expect(parsed.items[0].referenceCode).toBe('10063021');
    expect(parsed.items[0].totalValue).toBe('51.80');
  });

  it('captura o cEAN como GTIN válido', () => {
    expect(parsed.items[0].ean).toBe('7891234567895');
  });
});

describe('parseXml NF3e (energia, mod 66)', () => {
  const parsed = parseXml(nf3e);

  it('emitente = distribuidora e local de consumo = acessante', () => {
    expect(parsed.invoice.model).toBe('nf3e');
    expect(parsed.company.socialName).toBe('ENERGISA MATO GROSSO');
    expect(parsed.invoice.location?.city).toBe('Rondonopolis');
    expect(parsed.invoice.location?.state).toBe('MT');
  });

  it('itens de energia por cClass, preço unitário = vItem/qFaturada (R$/kWh)', () => {
    expect(parsed.items).toHaveLength(2);
    const consumo = parsed.items[0];
    expect(consumo.type).toBe('energy');
    expect(consumo.referenceCode).toBe('0601000');
    expect(consumo.name).toBe('Consumo de energia elétrica');
    expect(consumo.unit).toBe('kWh');
    expect(Number(consumo.unitValue)).toBeCloseTo(1.19408); // 298.52 / 250
    const cosip = parsed.items[1];
    expect(cosip.referenceCode).toBe('0801000');
    expect(Number(cosip.unitValue)).toBeCloseTo(2.5); // qFaturada 1
  });

  it('pula a linha sem qFaturada válida (não grava o total como R$/kWh)', () => {
    const semQtd = nf3e.replace('<qFaturada>250</qFaturada>', '<qFaturada>0</qFaturada>');
    const p = parseXml(semQtd);
    // A linha de consumo (qFaturada=0) é descartada; sobra só o COSIP (qFaturada=1).
    expect(p.items).toHaveLength(1);
    expect(p.items[0].referenceCode).toBe('0801000');
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

  it('deixa ean undefined quando cEAN é "SEM GTIN"', () => {
    expect(parsed.items[0].ean).toBeUndefined();
  });

  it('deriva o tributo aproximado por unidade de vTotTrib ÷ qCom', () => {
    // 34.81 (total da linha) / 38.4520 L ≈ 0.9053 R$/L
    expect(Number(parsed.items[0].unitTaxValue)).toBeCloseTo(0.9053, 4);
  });

  it('deixa unitTaxValue undefined quando o emitente não publica vTotTrib', () => {
    // A tag é opcional: muitos emitentes cumprem a Lei 12.741 só via infCpl.
    const semTrib = nfe.replace('<vTotTrib>34.81</vTotTrib>', '');
    expect(parseXml(semTrib).items[0].unitTaxValue).toBeUndefined();
  });

  it('deixa unitTaxValue undefined quando não há qCom para dividir', () => {
    const semQtd = nfe.replace('<qCom>38.4520</qCom>', '<qCom>0</qCom>');
    expect(parseXml(semQtd).items[0].unitTaxValue).toBeUndefined();
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
