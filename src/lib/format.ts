/** Formatação pt-BR para percentuais e preços unitários (privacy-first: sem totais). */

/** Razão (0.089) → "8,9%". `signed` prefixa "+" em positivos. */
export function formatPct(
  ratio: number,
  { signed = false, decimals = 1 }: { signed?: boolean; decimals?: number } = {},
): string {
  const pct = ratio * 100;
  const s = pct.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${signed && pct > 0 ? '+' : ''}${s}%`;
}

/** Diferença em pontos percentuais (já em pp) → "+3,8 p.p.". */
export function formatPp(pp: number): string {
  const s = pp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${pp > 0 ? '+' : ''}${s} p.p.`;
}

/** Preço unitário em reais → "R$ 18,50" (use `decimals: 6` para R$/kWh). */
export function formatPrice(reais: number, decimals = 2): string {
  return `R$ ${reais.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Preço digitado pelo usuário → número. Aceita o formato brasileiro ("12,99",
 * "1.234,56", "R$ 7,5") e o ponto decimal ("12.99"). Inválido/vazio → `NaN`.
 */
export function parsePrice(text: string): number {
  const t = text.trim().replace(/[^\d.,]/g, '');
  if (!t) {
    return Number.NaN;
  }
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(normalized);
}

/**
 * Fuso de referência do app. Notas trazem o instante com offset do emitente
 * (`-04:00` no MT, `-03:00` em SP); agrupar por `toISOString()` (UTC) jogaria a
 * compra das 22h do último dia do mês para o mês seguinte.
 */
export const APP_TIME_ZONE = 'America/Sao_Paulo';

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Instante → "yyyy-mm-dd" no fuso de Brasília (valor de `<input type="date">`). */
export function toDateInputValue(date: Date | string): string {
  return ymdFormatter.format(new Date(date));
}

/** Instante → "yyyy-mm" (mês de competência) no fuso de Brasília. */
export function monthKey(date: Date | string): string {
  return toDateInputValue(date).slice(0, 7);
}

/** Contagem de amostras com plural correto ("1 amostra", "3 amostras"). */
export function samplesText(n: number): string {
  return n === 1 ? '1 amostra' : `${n} amostras`;
}

/** Aviso de quantas amostras são preço de encarte (oferta), já pluralizado. */
export function offerSamplesText(n: number): string {
  return n === 1 ? 'inclui 1 preço de encarte' : `inclui ${n} preços de encarte`;
}
