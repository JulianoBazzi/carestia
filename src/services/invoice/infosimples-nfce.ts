import { onlyNumbers } from '@julianobazzi/utils';
import { UFS } from '~/lib/ufs';
import type { InfosimplesNfce, InfosimplesNfceProduct } from '~/schemas/infosimples';
import type { ICompanyDTO, IInvoiceDTO, IItemDTO, IParsedInvoice } from '~/services/invoice/parser';

/**
 * Adapta a resposta JSON da NFC-e (Infosimples) para o mesmo `IParsedInvoice`
 * produzido pelo parser de XML, reaproveitando todo o pipeline a jusante
 * (`importParsedInvoice` → `findOrCreateItem` → persistência).
 *
 * O portal da NFC-e não expõe NCM nem GTIN, então `referenceCode` fica VAZIO e
 * `ean` fica indefinido. O produto entra no catálogo no "bucket sem NCM"
 * (`reference_code = ''`) e a unificação com o item equivalente vindo de XML é
 * feita pela MESCLAGEM manual na tela de Itens — o nome da NFC-e vira alias do
 * item original e as importações seguintes caem nele sozinhas (ver `resolveAlias`
 * em `item-matching.ts`).
 *
 * O `codigo` do produto é ignorado de propósito: é o código interno do ERP do
 * emitente, sem significado fora daquele CNPJ.
 */

const UF_SET = new Set<string>(UFS);

/** Preenchimentos que o emitente usa no lugar de deixar o campo em branco. */
const PLACEHOLDERS = new Set(['NAO INFORMADO', 'NAO INFORMADA', 'SEM INFORMACAO', 'N/A', '-']);

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** Descarta preenchimentos de placeholder, tratando-os como campo vazio. */
function meaningful(value: string): string | undefined {
  const v = value.trim();
  if (!v || PLACEHOLDERS.has(v.toUpperCase())) {
    return undefined;
  }
  return v;
}

/**
 * Converte valor monetário pt-BR ("1.234,56") para decimal. Quando há vírgula, o
 * ponto é separador de milhar; sem vírgula, o ponto já é o decimal (algumas UFs
 * devolvem nesse formato). Cai no `fallback` numérico da Infosimples quando a
 * string está ausente ou é o literal "NaN" — que a API realmente emite (visto em
 * `formas_pagamento`).
 */
export function parseMoney(raw: unknown, fallback?: number | null): string {
  const s = text(raw);
  if (s && s.toUpperCase() !== 'NAN') {
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
      return normalized;
    }
  }
  if (fallback != null && Number.isFinite(fallback)) {
    return String(fallback);
  }
  return '0';
}

/**
 * Monta a data ISO a partir de `dd/mm/yyyy` + `hh:mm[:ss]`. A SEFAZ informa a
 * hora local do emitente sem fuso; fixamos -03:00 (Brasília) para o instante não
 * depender do fuso do servidor. Sem hora usável, meio-dia — assim nenhum
 * arredondamento de fuso empurra a nota para o mês vizinho.
 */
export function toIsoDateTime(date: unknown, time: unknown): string {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text(date));
  if (!d) {
    throw new Error('Data de emissão ausente ou inválida na resposta da Infosimples.');
  }
  const [, day, month, year] = d;
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text(time));
  const clock = t ? `${t[1]}:${t[2]}:${t[3] ?? '00'}` : '12:00:00';
  return `${year}-${month}-${day}T${clock}-03:00`;
}

/**
 * O emitente da NFC-e vem com o endereço num texto único, separado por vírgulas
 * ("RUA X, LOJA 01 , 478 , NAO INFORMADO , VILA AURORA , RONDONOPOLIS , MT").
 * Aproveitamos só a CAUDA — bairro/cidade/UF —, que é o suficiente para o índice
 * regional e evita guardar rua/número (privacy-first). Só aceitamos quando o
 * último segmento é uma UF válida; caso contrário devolvemos vazio e o
 * `resolveCompany` preenche pelo banco/BrasilAPI.
 *
 * Vantagem sobre a BrasilAPI: este é o endereço da FILIAL onde a compra
 * aconteceu, não o cadastro do CNPJ.
 */
export function parseAddressTail(address: unknown): {
  neighborhood?: string;
  city?: string;
  state?: string;
} {
  const parts = text(address)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) {
    return {};
  }

  const state = parts[parts.length - 1].toUpperCase();
  if (!UF_SET.has(state)) {
    return {};
  }

  return {
    state,
    city: meaningful(parts[parts.length - 2]),
    neighborhood: meaningful(parts[parts.length - 3]),
  };
}

function toItem(product: InfosimplesNfceProduct): IItemDTO {
  const name = text(product.nome);
  return {
    type: 'product',
    // Sem NCM na NFC-e — ver o cabeçalho deste arquivo.
    referenceCode: '',
    name,
    unit: meaningful(text(product.unidade)),
    description: name,
    // Transitórios (nunca persistidos), mantidos por paridade com o parser de XML.
    quantity: parseMoney(product.quantidade),
    unitValue: parseMoney(product.valor_unitario, product.normalizado_valor_unitario),
    totalValue: parseMoney(product.valor_total_produto, product.normalizado_valor_total_produto),
  };
}

/** Converte `data[0]` da consulta de NFC-e no DTO comum de nota importada. */
export function parseInfosimplesNfce(record: InfosimplesNfce): IParsedInvoice {
  const info = record.informacoes_nota;
  const accessKey = onlyNumbers(text(info.chave_acesso));
  if (accessKey.length !== 44) {
    throw new Error('Chave de acesso ausente ou inválida na resposta da Infosimples.');
  }

  const location = parseAddressTail(record.emitente.endereco);

  const company: ICompanyDTO = {
    document: onlyNumbers(text(record.emitente.cnpj)),
    socialName: text(record.emitente.nome_razao_social),
    neighborhood: location.neighborhood,
    city: location.city,
    state: location.state,
  };

  const invoice: IInvoiceDTO = {
    model: 'nfce',
    number: text(info.numero),
    series: meaningful(text(info.serie)),
    accessKey,
    issuedAt: toIsoDateTime(info.data_emissao ?? info.data_autorizacao, info.hora_emissao),
    // Transitório — a nota não persiste total (privacy-first).
    totalValue: '0',
  };

  return { company, invoice, items: record.produtos.map(toItem) };
}
