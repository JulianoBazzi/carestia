/**
 * Heurísticas puras sobre o texto de uma conta de energia (DANF3e) em PDF.
 * Separado de `danfe-pdf.ts` (que carrega o unpdf) para ser testável isoladamente.
 */

import { onlyNumbers } from '@julianobazzi/utils';

const DISTRIBUIDORAS = [
  'Energisa',
  'CPFL',
  'Enel',
  'Cemig',
  'Light',
  'Neoenergia',
  'Coelba',
  'Celpe',
  'Cosern',
  'Equatorial',
  'EDP',
  'Copel',
  'Celesc',
  'Elektro',
  'RGE',
  'Sulgipe',
];

export interface IDanfeDraft {
  distribuidora?: string;
  accessKey?: string;
  issuedAt?: string; // yyyy-mm-dd (1º dia da competência)
  unitPriceKwh?: number; // R$/kWh
  /** Campos crus detectados, para exibir/depurar. */
  raw: { competencia?: string; consumoKwh?: string; total?: string };
}

export function extractDanfeFields(text: string): IDanfeDraft {
  const flat = text.replace(/\s+/g, ' ');

  const distribuidora = DISTRIBUIDORAS.find((d) => flat.toLowerCase().includes(d.toLowerCase()));

  // Chave de acesso: 44 dígitos (podem vir separados por espaços).
  const digits = flat.replace(/[^\d ]/g, ' ');
  const keyMatch = digits.match(/(?:\d[ ]?){44}/);
  const accessKey = keyMatch ? onlyNumbers(keyMatch[0]).slice(0, 44) : undefined;

  // Competência / referência: MM/AAAA.
  const comp = flat.match(
    /(?:compet[êe]ncia|refer[êe]ncia|m[êe]s[\s/]*ano)\D{0,12}(\d{2})\/(\d{4})/i,
  );
  const competencia = comp ? `${comp[1]}/${comp[2]}` : undefined;
  const issuedAt = comp ? `${comp[2]}-${comp[1]}-01` : undefined;

  // Tarifa R$/kWh: valor com 4–6 casas decimais próximo de "kWh".
  const tarifa =
    flat.match(/(\d+[.,]\d{4,6})\s*(?:R?\$?\s*\/?\s*)?kWh/i) ??
    flat.match(/kWh\D{0,20}(\d+[.,]\d{4,6})/i);
  const unitPriceKwh = tarifa ? Number(tarifa[1].replace(/\./g, '').replace(',', '.')) : undefined;

  const consumo = flat.match(/consumo\D{0,20}(\d[\d.]*),?\d*\s*kWh/i);
  const total = flat.match(
    /total\s*(?:a pagar|da conta|geral)?\D{0,12}R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );

  return {
    distribuidora,
    accessKey,
    issuedAt,
    unitPriceKwh: unitPriceKwh && Number.isFinite(unitPriceKwh) ? unitPriceKwh : undefined,
    raw: { competencia, consumoKwh: consumo?.[1], total: total?.[1] },
  };
}
