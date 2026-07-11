import { XMLParser } from 'fast-xml-parser';

export type InvoiceType = 'nfe' | 'nfce' | 'nfse' | 'nf3e';

export interface ICompanyDTO {
  document: string; // CNPJ
  socialName: string;
  fantasyName?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  ibgeCode?: string;
  state?: string;
  zipcode?: string;
}

export interface IItemDTO {
  type: 'product' | 'service' | 'energy';
  referenceCode: string; // NCM (product) | cTribNac (service) | cClass (energia)
  name: string;
  unit?: string;
  ean?: string; // GTIN/EAN comercial (cEAN); undefined quando "SEM GTIN"/inválido
  nbsCode?: string;
  description: string;
  quantity: string; // raw decimal
  unitValue: string; // raw decimal
  totalValue: string; // raw decimal
}

export interface IInvoiceLocation {
  neighborhood?: string;
  city?: string;
  state?: string;
  ibgeCode?: string;
}

export interface IInvoiceDTO {
  model: InvoiceType;
  number: string;
  series?: string;
  accessKey: string;
  issuedAt: string;
  totalValue: string; // raw decimal (transitório — não é persistido)
  /** Local da compra/consumo (energia usa o acessante; demais herdam o emitente). */
  location?: IInvoiceLocation;
}

export interface IParsedInvoice {
  company: ICompanyDTO;
  invoice: IInvoiceDTO;
  items: IItemDTO[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false, // mantém valores como string (preserva precisão)
  parseAttributeValue: false,
  trimValues: true,
});

/** Normaliza um nó que pode ser objeto único ou array para sempre array. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

/**
 * Normaliza o cEAN da NF-e para um GTIN válido ou `undefined`. A NF-e usa o
 * literal `"SEM GTIN"` quando o produto não tem código de barras (combustíveis,
 * granéis, etc.); só aceitamos EAN-8/12/13/14 (dígitos).
 */
export function validEan(value: unknown): string | undefined {
  const s = str(value).trim();
  return /^\d{8}$|^\d{12,14}$/.test(s) ? s : undefined;
}

/** NF-e (modelo 55) e NFC-e (modelo 65) compartilham a mesma estrutura; o modelo
 * é distinguido por `ide.mod`. */
function nfeModel(infNFe: { ide?: { mod?: unknown } } | undefined): 'nfe' | 'nfce' {
  return str(infNFe?.ide?.mod) === '65' ? 'nfce' : 'nfe';
}

export function detectType(xml: string): InvoiceType {
  const obj = parser.parse(xml);
  const infNFe = obj.nfeProc?.NFe?.infNFe ?? obj.NFe?.infNFe;
  if (infNFe) return nfeModel(infNFe);
  if (obj.nf3eProc || obj.NF3e) return 'nf3e';
  if (obj.NFSe) return 'nfse';
  throw new Error('XML não reconhecido como NF-e, NFC-e, NF3e nem NFS-e.');
}

export function parseXml(xml: string): IParsedInvoice {
  const obj = parser.parse(xml);
  if (obj.nfeProc || obj.NFe) return parseNFe(obj);
  if (obj.nf3eProc || obj.NF3e) return parseNF3e(obj);
  if (obj.NFSe) return parseNFSe(obj);
  throw new Error('XML não reconhecido como NF-e, NFC-e, NF3e nem NFS-e.');
}

// biome-ignore lint/suspicious/noExplicitAny: estrutura XML dinâmica
export function parseNFe(obj: any): IParsedInvoice {
  const infNFe = obj.nfeProc?.NFe?.infNFe ?? obj.NFe?.infNFe;
  if (!infNFe) throw new Error('infNFe ausente no XML da NF-e.');

  const emit = infNFe.emit;
  const addr = emit.enderEmit ?? {};
  const accessKey = str(infNFe['@_Id']).replace(/^NFe/, '');

  const company: ICompanyDTO = {
    document: str(emit.CNPJ),
    socialName: str(emit.xNome),
    fantasyName: emit.xFant ? str(emit.xFant) : undefined,
    street: addr.xLgr ? str(addr.xLgr) : undefined,
    number: addr.nro ? str(addr.nro) : undefined,
    neighborhood: addr.xBairro ? str(addr.xBairro) : undefined,
    city: addr.xMun ? str(addr.xMun) : undefined,
    ibgeCode: addr.cMun ? str(addr.cMun) : undefined,
    state: addr.UF ? str(addr.UF) : undefined,
    zipcode: addr.CEP ? str(addr.CEP) : undefined,
  };

  const items: IItemDTO[] = toArray(infNFe.det).map((det) => {
    const prod = det.prod;
    return {
      type: 'product' as const,
      referenceCode: str(prod.NCM),
      name: str(prod.xProd),
      unit: prod.uCom ? str(prod.uCom) : undefined,
      ean: validEan(prod.cEAN),
      description: str(prod.xProd),
      quantity: str(prod.qCom),
      unitValue: str(prod.vUnCom),
      totalValue: str(prod.vProd),
    };
  });

  const invoice: IInvoiceDTO = {
    model: nfeModel(infNFe),
    number: str(infNFe.ide?.nNF),
    series: infNFe.ide?.serie ? str(infNFe.ide.serie) : undefined,
    accessKey,
    issuedAt: str(infNFe.ide?.dhEmi),
    totalValue: str(infNFe.total?.ICMSTot?.vNF),
  };

  return { company, invoice, items };
}

// biome-ignore lint/suspicious/noExplicitAny: estrutura XML dinâmica
export function parseNFSe(obj: any): IParsedInvoice {
  const inf = obj.NFSe.infNFSe;
  if (!inf) throw new Error('infNFSe ausente no XML da NFS-e.');

  const emit = inf.emit;
  const addr = emit.enderNac ?? {};
  const dps = inf.DPS?.infDPS ?? {};
  const serv = dps.serv ?? {};
  const cServ = serv.cServ ?? {};
  const values = dps.valores?.vServPrest ?? {};

  const company: ICompanyDTO = {
    document: str(emit.CNPJ),
    socialName: str(emit.xNome),
    street: addr.xLgr ? str(addr.xLgr) : undefined,
    number: addr.nro ? str(addr.nro) : undefined,
    neighborhood: addr.xBairro ? str(addr.xBairro) : undefined,
    city: inf.xLocPrestacao ? str(inf.xLocPrestacao) : undefined,
    ibgeCode: addr.cMun ? str(addr.cMun) : undefined,
    state: addr.UF ? str(addr.UF) : undefined,
    zipcode: addr.CEP ? str(addr.CEP) : undefined,
  };

  const serviceValue = str(values.vServ ?? inf.valores?.vLiq);
  const item: IItemDTO = {
    type: 'service',
    referenceCode: str(cServ.cTribNac),
    name: str(cServ.xDescServ ?? inf.xTribNac),
    nbsCode: cServ.cNBS ? str(cServ.cNBS) : undefined,
    description: str(cServ.xDescServ ?? inf.xTribNac),
    quantity: '1',
    unitValue: serviceValue,
    totalValue: serviceValue,
  };

  const invoice: IInvoiceDTO = {
    model: 'nfse',
    number: str(inf.nNFSe),
    series: dps.serie ? str(dps.serie) : undefined,
    accessKey: str(inf['@_Id']),
    issuedAt: str(inf.dhProc ?? dps.dhEmi),
    totalValue: str(inf.valores?.vLiq ?? serviceValue),
  };

  return { company, invoice, items: [item] };
}

/** Rótulo padrão por família de cClass da NF3e (usado quando não há descrição no item). */
export function cClassLabel(cClass: string): string {
  const g = cClass.slice(0, 3);
  if (g === '060') return 'Consumo de energia elétrica';
  if (cClass.startsWith('56')) return 'Energia injetada (GD)';
  if (g === '064') return 'Adicional de bandeira tarifária';
  if (g === '080') return 'Contribuição de Iluminação Pública';
  return 'Item da conta de energia';
}

/**
 * NF3e (Nota Fiscal de Energia Elétrica Eletrônica, modelo 66).
 * Estrutura análoga à NF-e, mas com `<infNF3e>`, emitente = distribuidora, itens
 * em `det/detItem` classificados por `cClass` (sem NCM) e medidos em kWh.
 * Privacy-first: guardamos o preço unitário (R$/kWh = vItem/qFaturada), descartando
 * a quantidade consumida; o local de consumo (acessante) vira o índice regional.
 * Obs.: nomes de tags conforme MOC NF3e — ajustar contra um XML real se necessário.
 *
 * biome-ignore lint/suspicious/noExplicitAny: estrutura XML dinâmica
 */
export function parseNF3e(obj: any): IParsedInvoice {
  const infNF3e = obj.nf3eProc?.NF3e?.infNF3e ?? obj.NF3e?.infNF3e;
  if (!infNF3e) throw new Error('infNF3e ausente no XML da NF3e.');

  const emit = infNF3e.emit ?? {};
  const addr = emit.enderEmit ?? {};
  const accessKey = str(infNF3e['@_Id']).replace(/^NF3e/, '');

  const company: ICompanyDTO = {
    document: str(emit.CNPJ),
    socialName: str(emit.xNome),
    fantasyName: emit.xFant ? str(emit.xFant) : undefined,
    street: addr.xLgr ? str(addr.xLgr) : undefined,
    number: addr.nro ? str(addr.nro) : undefined,
    neighborhood: addr.xBairro ? str(addr.xBairro) : undefined,
    city: addr.xMun ? str(addr.xMun) : undefined,
    ibgeCode: addr.cMun ? str(addr.cMun) : undefined,
    state: addr.UF ? str(addr.UF) : undefined,
    zipcode: addr.CEP ? str(addr.CEP) : undefined,
  };

  // Local de consumo = endereço do acessante (anonimizado: bairro/cidade/UF).
  const acess = infNF3e.acessante ?? infNF3e.dest ?? {};
  const acessAddr = acess.enderAcessante ?? acess.ender ?? acess.enderNac ?? {};
  const location = {
    neighborhood: acessAddr.xBairro ? str(acessAddr.xBairro) : undefined,
    city: acessAddr.xMun ? str(acessAddr.xMun) : undefined,
    state: acessAddr.UF ? str(acessAddr.UF) : undefined,
    ibgeCode: acessAddr.cMun ? str(acessAddr.cMun) : undefined,
  };

  const items: IItemDTO[] = toArray(infNF3e.det).flatMap((det) => {
    const di = det.detItem ?? det.det ?? det;
    const cClass = str(di.cClass);
    const description = str(di.xProd ?? di.descricao ?? di.xDesc ?? '') || cClassLabel(cClass);
    const unit = str(di.uMed ?? di.uCom) || 'kWh';
    const qFaturada = Number(str(di.qFaturada ?? di.qCom ?? '0'));
    const vItem = str(di.vItem ?? di.vProd ?? '0');
    // Sem quantidade faturada válida não há como calcular R$/kWh. Pular a linha —
    // gravar o TOTAL como se fosse preço unitário poluiria a série de energia.
    if (!(qFaturada > 0)) return [];
    // Preço unitário R$/kWh = valor do item ÷ quantidade faturada.
    const unitValue = String(Number(vItem) / qFaturada);
    return [
      {
        type: 'energy' as const,
        referenceCode: cClass,
        name: description,
        unit,
        description,
        quantity: str(qFaturada), // transitório — não persistido
        unitValue,
        totalValue: vItem, // transitório
      },
    ];
  });

  const invoice: IInvoiceDTO = {
    model: 'nf3e',
    number: str(infNF3e.ide?.nNF),
    series: infNF3e.ide?.serie ? str(infNF3e.ide.serie) : undefined,
    accessKey,
    issuedAt: str(infNF3e.ide?.dhEmi),
    totalValue: str(infNF3e.total?.vNF ?? '0'),
    location,
  };

  return { company, invoice, items };
}
