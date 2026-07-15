import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A importação roda fora de transação (ver import.ts) — o mock do client
// expõe os delegates direto; `tx` é mantido como alias para as asserções.
const { tx, prismaMock, fetchCnpj } = vi.hoisted(() => {
  const tx = {
    company: { upsert: vi.fn(), findUnique: vi.fn() },
    item: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    itemAlias: { findUnique: vi.fn() },
    invoice: { create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return { tx, prismaMock: tx, fetchCnpj: vi.fn() };
});

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));
vi.mock('~/services/brasilapi', () => ({ fetchCnpj }));

import { importInvoice } from '~/services/invoice/import';

const fixtures = join(__dirname, '__fixtures__');
const nfe = readFileSync(join(fixtures, 'nfe.xml'), 'utf-8');
const nfse = readFileSync(join(fixtures, 'nfse.xml'), 'utf-8');

// NFC-e (produto) sem endereço no XML — aciona o fallback da BrasilAPI.
const nfceNoAddress = `<nfeProc><NFe><infNFe Id="NFe65260611111111000111650010000000011000000018"><ide><mod>65</mod><nNF>1</nNF><serie>1</serie><dhEmi>2026-06-02T10:00:00-03:00</dhEmi></ide><emit><CNPJ>11111111000111</CNPJ><xNome>EMPRESA SEM ENDERECO</xNome></emit><det><prod><NCM>22030000</NCM><xProd>CERVEJA LATA</xProd><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>5.00</vUnCom><vProd>10.00</vProd></prod></det><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;

// NFC-e (modelo 65): mesma estrutura da NF-e, distinguida por ide.mod=65.
const nfce = `<nfeProc><NFe><infNFe Id="NFe65260612345678000199650010000000011000000017"><ide><mod>65</mod><nNF>1</nNF><serie>1</serie><dhEmi>2026-06-02T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>MERCADO EXEMPLO</xNome><enderEmit><xLgr>RUA A</xLgr><nro>10</nro><xBairro>CENTRO</xBairro><xMun>PORTO ALEGRE</xMun><cMun>4314902</cMun><UF>RS</UF><CEP>90000000</CEP></enderEmit></emit><det><prod><NCM>22030000</NCM><xProd>CERVEJA LATA</xProd><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>5.00</vUnCom><vProd>10.00</vProd></prod></det><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([]); // sem candidato parecido → cria via upsert
  tx.item.findMany.mockResolvedValue([]); // nenhum item com o mesmo EAN
  tx.item.findUnique.mockResolvedValue(null); // unique exata sem hit (nem zumbi nem ignorado)
  tx.itemAlias.findUnique.mockResolvedValue(null); // sem nome alternativo (alias de mesclagem)
  tx.company.upsert.mockResolvedValue({ id: 'company-1' });
  tx.company.findUnique.mockResolvedValue(null); // empresa ainda não cadastrada
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
    expect(invoiceArg.items.createMany.data[0].quantity).toBeUndefined();
    expect(invoiceArg.items.createMany.data[0].total_value).toBeUndefined();
    expect(invoiceArg.items.createMany.data[0].unit_value).toBeCloseTo(3.68); // R$/un

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

describe('importInvoice — dedup por similaridade (pg_trgm)', () => {
  it('reaproveita item existente parecido em vez de criar outro', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'item-existente', sim: 0.92 }]);

    const result = await importInvoice('user-1', nfe);

    expect(result.status).toBe('imported');
    // Candidato acima do limiar → não cria item novo.
    expect(tx.item.upsert).not.toHaveBeenCalled();
    const invoiceArg = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceArg.items.createMany.data[0].item_id).toBe('item-existente');
  });
});

describe('importInvoice — item ignorado', () => {
  it('descarta a linha de item ignorado, mas ainda cria a nota (dedup por chave)', async () => {
    // A unique exata casa um item permanentemente ignorado pela administração.
    tx.item.findUnique.mockResolvedValue({
      id: 'bloqueado',
      deleted_at: new Date('2026-01-01'),
      ignored_at: new Date('2026-01-01'),
    });

    const result = await importInvoice('user-1', nfe);

    expect(result).toEqual({
      status: 'imported',
      invoiceId: 'invoice-1',
      accessKey: '51260602760668000677550010001165321018655643',
      ignoredItems: 1,
    });
    // Nem cria item novo, nem anexa a linha à nota.
    expect(tx.item.upsert).not.toHaveBeenCalled();
    expect(tx.invoice.create.mock.calls[0][0].data.items.createMany.data).toEqual([]);
  });
});

describe('importInvoice — dedupe no lote', () => {
  it('marca chave repetida como duplicated sem tocar o banco', async () => {
    const seen = new Set<string>();
    const first = await importInvoice('user-1', nfe, seen);
    const second = await importInvoice('user-1', nfe, seen);

    expect(first.status).toBe('imported');
    expect(second.status).toBe('duplicated');
    // create chamado só 1x (segunda foi barrada antes de tocar o banco)
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
  });
});

describe('importInvoice — NFS-e', () => {
  it('bloqueia NFS-e com mensagem de versão futura, sem tocar o banco', async () => {
    const result = await importInvoice('user-1', nfse);
    expect(result).toEqual({
      status: 'error',
      message: 'A importação de NFS-e (nota de serviço) será incluída em uma versão futura.',
    });
    expect(tx.company.upsert).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });
});

describe('importInvoice — NFC-e', () => {
  it('detecta modelo 65 (nfce) e grava produto', async () => {
    const result = await importInvoice('user-1', nfce);
    expect(result.status).toBe('imported');

    const invoiceArg = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceArg.model).toBe('nfce');
    expect(invoiceArg.items.createMany.data[0].unit_value).toBeCloseTo(5); // R$ 5,00/un

    const itemArg = tx.item.upsert.mock.calls[0][0];
    expect(itemArg.create.type).toBe('product');
    expect(itemArg.create.reference_code).toBe('22030000');
  });

  it('não consulta BrasilAPI quando NFC-e tem endereço', async () => {
    await importInvoice('user-1', nfce);
    expect(fetchCnpj).not.toHaveBeenCalled();
  });
});

describe('importInvoice — linhas repetidas e paralelismo', () => {
  // Mesmo produto em duas linhas (cupom com item escaneado 2×).
  const nfceRepeatedLine = nfce.replace(/<det>.*<\/det>/, (det) => det + det);
  // Duas linhas de produtos diferentes (valida a ordem das rows pós-paralelismo).
  const nfceTwoProducts = nfce.replace(
    /<det>.*<\/det>/,
    (det) => det + det.replace('CERVEJA LATA', 'AGUA MINERAL').replace('22030000', '22011000'),
  );

  it('linhas idênticas resolvem o item UMA vez e geram uma row por linha', async () => {
    const result = await importInvoice('user-1', nfceRepeatedLine);

    expect(result.status).toBe('imported');
    // Identidade repetida não re-roda o matching (nem a query de similaridade).
    expect(tx.item.upsert).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const rows = tx.invoice.create.mock.calls[0][0].data.items.createMany.data;
    expect(rows).toHaveLength(2);
    expect(rows[0].item_id).toBe('item-1');
    expect(rows[1].item_id).toBe('item-1');
  });

  it('preserva a ordem das linhas da nota nas rows criadas', async () => {
    tx.item.upsert.mockImplementation((arg: { create: { name: string } }) =>
      Promise.resolve({ id: `item-${arg.create.name}` }),
    );

    const result = await importInvoice('user-1', nfceTwoProducts);

    expect(result.status).toBe('imported');
    const rows = tx.invoice.create.mock.calls[0][0].data.items.createMany.data;
    expect(rows.map((r: { item_id: string }) => r.item_id)).toEqual([
      'item-CERVEJA LATA',
      'item-AGUA MINERAL',
    ]);
  });
});

describe('importInvoice — empresa já cadastrada (XML sem endereço)', () => {
  it('usa a localização do banco e pula a BrasilAPI', async () => {
    tx.company.findUnique.mockResolvedValue({
      social_name: 'EMPRESA SEM ENDERECO LTDA',
      fantasy_name: 'LOJA',
      neighborhood: 'CENTRO',
      city: 'RONDONOPOLIS',
      state: 'MT',
      ibge_code: '5107602',
    });

    const result = await importInvoice('user-1', nfceNoAddress);

    expect(result.status).toBe('imported');
    expect(fetchCnpj).not.toHaveBeenCalled();
    // A localização conhecida preenche o local (anonimizado) da nota.
    const invoiceArg = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceArg.city).toBe('RONDONOPOLIS');
    expect(invoiceArg.state).toBe('MT');
    expect(invoiceArg.ibge_code).toBe('5107602');
  });

  it('empresa cadastrada mas ainda sem localização cai na BrasilAPI', async () => {
    tx.company.findUnique.mockResolvedValue({
      social_name: 'EMPRESA SEM ENDERECO LTDA',
      fantasy_name: null,
      neighborhood: null,
      city: null,
      state: null,
      ibge_code: null,
    });

    await importInvoice('user-1', nfceNoAddress);

    expect(fetchCnpj).toHaveBeenCalledWith('11111111000111');
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

    await importInvoice('user-1', nfceNoAddress);

    expect(fetchCnpj).toHaveBeenCalledWith('11111111000111');
    const create = tx.company.upsert.mock.calls[0][0].create;
    expect(create.origin).toBe('brasilapi');
    // Privacy-first: só o local regional é aproveitado — rua/CEP nem existem mais.
    expect(create.neighborhood).toBe('CENTRO');
    expect(create.city).toBe('CIDADE');
    expect(create.street).toBeUndefined();
  });
});

describe('importInvoice — erros', () => {
  it('retorna error para XML inválido', async () => {
    const result = await importInvoice('user-1', '<foo/>');
    expect(result.status).toBe('error');
    expect(tx.company.upsert).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('retorna duplicated em violação de unique (P2002)', async () => {
    tx.invoice.create.mockRejectedValue({ code: 'P2002' });
    const result = await importInvoice('user-1', nfe);
    expect(result).toEqual({
      status: 'duplicated',
      accessKey: '51260602760668000677550010001165321018655643',
    });
  });

  it('P2002 na resolução de item NÃO vira duplicated falso', async () => {
    // Corrida na criação do item: o upsert perde e a re-leitura pela unique
    // também não acha o vencedor (corrida fantasma) → o erro propaga como
    // error, nunca como "nota duplicada".
    tx.item.upsert.mockRejectedValue({ code: 'P2002' });

    const result = await importInvoice('user-1', nfe);

    expect(result.status).toBe('error');
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });
});
