import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx, prismaMock, fetchCnpj } = vi.hoisted(() => {
  const tx = {
    company: { upsert: vi.fn() },
    item: { upsert: vi.fn() },
    invoice: { create: vi.fn() },
  };
  return {
    tx,
    prismaMock: { $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)) },
    fetchCnpj: vi.fn(),
  };
});

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));
vi.mock('~/services/brasilapi', () => ({ fetchCnpj }));

import { importInvoice } from '~/services/invoice/import';

const fixtures = join(__dirname, '__fixtures__');
const nfe = readFileSync(join(fixtures, 'nfe.xml'), 'utf-8');
const nfse = readFileSync(join(fixtures, 'nfse.xml'), 'utf-8');

const nfseNoAddress = `<NFSe><infNFSe Id="NFS999"><nNFSe>9</nNFSe><dhProc>2026-06-01T00:00:00-03:00</dhProc><emit><CNPJ>11111111000111</CNPJ><xNome>EMPRESA SEM ENDERECO</xNome></emit><valores><vLiq>10.00</vLiq></valores><DPS><infDPS Id="DPS1"><serie>1</serie><serv><cServ><cTribNac>010701</cTribNac><xDescServ>SVC</xDescServ></cServ></serv><valores><vServPrest><vServ>10.00</vServ></vServPrest></valores></infDPS></DPS></infNFSe></NFSe>`;

// NFC-e (modelo 65): mesma estrutura da NF-e, distinguida por ide.mod=65.
const nfce = `<nfeProc><NFe><infNFe Id="NFe65260612345678000199650010000000011000000017"><ide><mod>65</mod><nNF>1</nNF><serie>1</serie><dhEmi>2026-06-02T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>MERCADO EXEMPLO</xNome><enderEmit><xLgr>RUA A</xLgr><nro>10</nro><xBairro>CENTRO</xBairro><xMun>PORTO ALEGRE</xMun><cMun>4314902</cMun><UF>RS</UF><CEP>90000000</CEP></enderEmit></emit><det><prod><NCM>22030000</NCM><xProd>CERVEJA LATA</xProd><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>5.00</vUnCom><vProd>10.00</vProd></prod></det><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  tx.company.upsert.mockResolvedValue({ id: 'company-1' });
  tx.item.upsert.mockResolvedValue({ id: 'item-1' });
  tx.invoice.create.mockResolvedValue({ id: 'invoice-1' });
  fetchCnpj.mockResolvedValue(null);
});

describe('importInvoice — NF-e', () => {
  it('importa guardando só o preço unitário (R$), sem quantidade nem total', async () => {
    const result = await importInvoice('user-1', nfe);

    expect(result).toEqual({
      status: 'imported',
      invoiceId: 'invoice-1',
      accessKey: '51260602760668000677550010001165321018655643',
    });

    const invoiceArg = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceArg.model).toBe('nfe');
    expect(invoiceArg.user_id).toBe('user-1');
    expect(invoiceArg.company_id).toBe('company-1');
    // Privacy-first: sem total da nota, XML cru, quantidade nem total por item.
    expect(invoiceArg.total_value).toBeUndefined();
    expect(invoiceArg.raw_xml).toBeUndefined();
    expect(invoiceArg.items.create[0].quantity).toBeUndefined();
    expect(invoiceArg.items.create[0].total_value).toBeUndefined();
    expect(invoiceArg.items.create[0].unit_value).toBeCloseTo(3.68); // R$/un

    const itemArg = tx.item.upsert.mock.calls[0][0];
    expect(itemArg.create.type).toBe('product');
    expect(itemArg.create.reference_code).toBe('22071090');
  });

  it('grava o local da compra (emitente) no nível da nota', async () => {
    await importInvoice('user-1', nfe);
    const invoiceArg = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceArg.state).toBe('MT');
    expect(invoiceArg.city).toBeTruthy();
  });

  it('não consulta BrasilAPI quando XML já tem endereço', async () => {
    await importInvoice('user-1', nfe);
    expect(fetchCnpj).not.toHaveBeenCalled();
    expect(tx.company.upsert.mock.calls[0][0].create.origin).toBe('xml');
  });
});

describe('importInvoice — dedupe no lote', () => {
  it('marca chave repetida como duplicated sem tocar o banco', async () => {
    const seen = new Set<string>();
    const first = await importInvoice('user-1', nfe, seen);
    const second = await importInvoice('user-1', nfe, seen);

    expect(first.status).toBe('imported');
    expect(second.status).toBe('duplicated');
    // create chamado só 1x (segunda foi barrada antes da transação)
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
  });
});

describe('importInvoice — NFS-e', () => {
  it('importa serviço com cTribNac e valor', async () => {
    const result = await importInvoice('user-1', nfse);
    expect(result.status).toBe('imported');

    const itemArg = tx.item.upsert.mock.calls[0][0];
    expect(itemArg.create.type).toBe('service');
    expect(itemArg.create.reference_code).toBe('010701');

    const invoiceArg = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceArg.items.create[0].unit_value).toBeCloseTo(60); // R$ 60,00
  });
});

describe('importInvoice — NFC-e', () => {
  it('detecta modelo 65 (nfce) e grava produto', async () => {
    const result = await importInvoice('user-1', nfce);
    expect(result.status).toBe('imported');

    const invoiceArg = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceArg.model).toBe('nfce');
    expect(invoiceArg.items.create[0].unit_value).toBeCloseTo(5); // R$ 5,00/un

    const itemArg = tx.item.upsert.mock.calls[0][0];
    expect(itemArg.create.type).toBe('product');
    expect(itemArg.create.reference_code).toBe('22030000');
  });

  it('não consulta BrasilAPI quando NFC-e tem endereço', async () => {
    await importInvoice('user-1', nfce);
    expect(fetchCnpj).not.toHaveBeenCalled();
  });
});

describe('importInvoice — BrasilAPI fallback', () => {
  it('consulta BrasilAPI quando XML não tem endereço', async () => {
    fetchCnpj.mockResolvedValue({
      cnpj: '11111111000111',
      razao_social: 'EMPRESA API',
      nome_fantasia: '',
      logradouro: 'RUA API',
      numero: '100',
      bairro: 'CENTRO',
      municipio: 'CIDADE',
      uf: 'MT',
      cep: '78700000',
      complemento: '',
      cnae_fiscal: 1,
      cnae_fiscal_descricao: '',
    });

    await importInvoice('user-1', nfseNoAddress);

    expect(fetchCnpj).toHaveBeenCalledWith('11111111000111');
    const create = tx.company.upsert.mock.calls[0][0].create;
    expect(create.origin).toBe('brasilapi');
    expect(create.street).toBe('RUA API');
  });
});

describe('importInvoice — erros', () => {
  it('retorna error para XML inválido', async () => {
    const result = await importInvoice('user-1', '<foo/>');
    expect(result.status).toBe('error');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('retorna duplicated em violação de unique (P2002)', async () => {
    tx.invoice.create.mockRejectedValue({ code: 'P2002' });
    const result = await importInvoice('user-1', nfe);
    expect(result).toEqual({
      status: 'duplicated',
      accessKey: '51260602760668000677550010001165321018655643',
    });
  });
});
