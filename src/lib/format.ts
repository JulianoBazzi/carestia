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
