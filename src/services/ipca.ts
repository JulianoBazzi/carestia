import { toDateInputValue } from '~/lib/format';

/** BCB lento não pode segurar o /api/inflation: sem resposta, degrada para []. */
const FETCH_TIMEOUT_MS = 5000;

export interface IIpcaPoint {
  month: string; // "YYYY-MM"
  pct: number; // variação mensal em % (0.58 = 0,58%)
}

interface IBcbRow {
  data: string; // "DD/MM/YYYY"
  valor: string;
}

/** Data → "DD/MM/YYYY" (formato do SGS), no fuso de Brasília. */
function fmt(date: Date): string {
  const [y, m, d] = toDateInputValue(date).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Busca o IPCA (variação mensal %) na série 433 do BCB SGS entre as datas.
 * Retorna [] em falha (UI degrada para só índice pessoal).
 */
export async function fetchIpca(from: Date, to: Date): Promise<IIpcaPoint[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=${fmt(from)}&dataFinal=${fmt(to)}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return [];
    }
    const rows = (await res.json()) as IBcbRow[];
    return rows.map((r) => {
      const [, month, year] = r.data.split('/');
      return { month: `${year}-${month}`, pct: Number(r.valor) };
    });
  } catch {
    return [];
  }
}
