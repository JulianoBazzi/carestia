import { XMLParser } from 'fast-xml-parser';

export type InvoiceType = 'nfe' | 'nfse';

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
  type: 'product' | 'service';
  referenceCode: string; // NCM (product) | cTribNac (service)
  name: string;
  unit?: string;
  nbsCode?: string;
  description: string;
  quantity: string; // raw decimal
  unitValue: string; // raw decimal
  totalValue: string; // raw decimal
}

export interface IInvoiceDTO {
  model: InvoiceType;
  number: string;
  series?: string;
  accessKey: string;
  issuedAt: string;
  totalValue: string; // raw decimal
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

export function detectType(xml: string): InvoiceType {
  const obj = parser.parse(xml);
  if (obj.nfeProc || obj.NFe) return 'nfe';
  if (obj.NFSe) return 'nfse';
  throw new Error('XML não reconhecido como NF-e nem NFS-e.');
}

export function parseXml(xml: string): IParsedInvoice {
  const obj = parser.parse(xml);
  if (obj.nfeProc || obj.NFe) return parseNFe(obj);
  if (obj.NFSe) return parseNFSe(obj);
  throw new Error('XML não reconhecido como NF-e nem NFS-e.');
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
      description: str(prod.xProd),
      quantity: str(prod.qCom),
      unitValue: str(prod.vUnCom),
      totalValue: str(prod.vProd),
    };
  });

  const invoice: IInvoiceDTO = {
    model: 'nfe',
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
