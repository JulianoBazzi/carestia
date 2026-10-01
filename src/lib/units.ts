import { normalizeName } from '~/lib/normalize';

/**
 * Tabela de→para de unidades. Mapeia variações de escrita (siglas, plural, forma
 * por extenso) para uma forma CANÔNICA curta, evitando itens duplicados quando a
 * mesma unidade chega escrita diferente entre emitentes (uCom da NF-e é texto livre).
 *
 * Convenções:
 * - Chaves e valores em UPPERCASE sem acento — a busca roda APÓS `normalizeName`.
 * - Só sinônimos VERDADEIROS entram. Unidades distintas NÃO são fundidas (merge é
 *   irreversível): `UN` (unidade) ≠ `PC` (peça) ≠ `PCT` (pacote); `CX` ≠ `CX2…CX100`
 *   (caixa com N unidades) ficam de fora de propósito.
 * - AMBÍGUO: `LT` = litro no padrão NF-e/SPED (lata = `LTA`), por isso `LT→L`.
 *   Se seus emitentes usarem `LT` como lata, remova essas linhas.
 * - Este arquivo é o ponto único de extensão; unidade desconhecida passa direto.
 */
export const UNIT_ALIASES: Record<string, string> = {
  // Unidade
  UNID: 'UN',
  UNIDADE: 'UN',
  UNIDADES: 'UN',
  UND: 'UN',
  UNI: 'UN',
  CADA: 'UN', // encarte: "R$ 6,59 cada"
  // Peça (distinta de UN e de PCT)
  PECA: 'PC',
  PECAS: 'PC',
  PCS: 'PC',
  // Volume — litro / mililitro (LT=litro no padrão SPED; lata = LTA)
  LT: 'L',
  LTR: 'L',
  LTS: 'L',
  LITRO: 'L',
  LITROS: 'L',
  MILILITRO: 'ML',
  MILILITROS: 'ML',
  MLS: 'ML',
  // Peso
  QUILO: 'KG',
  QUILOS: 'KG',
  QUILOGRAMA: 'KG',
  QUILOGRAMAS: 'KG',
  KGS: 'KG',
  KILO: 'KG',
  KILOS: 'KG',
  GRAMA: 'G',
  GRAMAS: 'G',
  GR: 'G',
  GRS: 'G',
  MILIGRAMA: 'MG',
  MILIGRAMAS: 'MG',
  TONELADA: 'TON',
  TONELADAS: 'TON',
  TN: 'TON',
  // Comprimento / área / volume
  METRO: 'M',
  METROS: 'M',
  MT: 'M',
  MTR: 'M',
  MTS: 'M',
  CENTIMETRO: 'CM',
  CENTIMETROS: 'CM',
  MILIMETRO: 'MM',
  MILIMETROS: 'MM',
  'METRO QUADRADO': 'M2',
  MTQ: 'M2',
  MT2: 'M2',
  'METRO CUBICO': 'M3',
  MTC: 'M3',
  MT3: 'M3',
  MC: 'M3',
  // Embalagens / logística
  CAIXA: 'CX',
  CAIXAS: 'CX',
  PACOTE: 'PCT',
  PACOTES: 'PCT',
  PCTE: 'PCT',
  PCTS: 'PCT',
  FARDO: 'FD',
  FARDOS: 'FD',
  DUZIA: 'DZ',
  DUZIAS: 'DZ',
  PARES: 'PAR',
  PR: 'PAR',
  JOGO: 'JG',
  JOGOS: 'JG',
  CONJUNTO: 'CJ',
  CONJUNTOS: 'CJ',
  CONJ: 'CJ',
  KIT: 'CJ',
  ROLO: 'RL',
  ROLOS: 'RL',
  SACO: 'SC',
  SACOS: 'SC',
  SACA: 'SC',
  SACAS: 'SC',
  GALAO: 'GL',
  GALOES: 'GL',
  BALDE: 'BD',
  BALDES: 'BD',
  BANDEJA: 'BJ',
  BANDEJAS: 'BJ',
  BANDEJ: 'BJ',
  BDJ: 'BJ',
  BOBINA: 'BB',
  BOBINAS: 'BB',
  FRASCO: 'FR',
  FRASCOS: 'FR',
  VIDRO: 'VD',
  VIDROS: 'VD',
  LATA: 'LTA',
  LATAS: 'LTA',
  LA1: 'LTA', // sufixo "1" de ERP sobre "LA" (lata); LTA é o canônico (LT=litro)
  AMPOLA: 'AMP',
  AMPOLAS: 'AMP',
  CAPSULA: 'CAP',
  CAPSULAS: 'CAP',
  CAPS: 'CAP',
  MILHEIRO: 'MIL',
  MILHEIROS: 'MIL',
  MILHEI: 'MIL',
  // Energia
  'KW/H': 'KWH',
  'KW-H': 'KWH',
  'KW H': 'KWH',
};

/** Conjunto de formas canônicas (valores da tabela), usado na regra do sufixo "1". */
const CANONICAL_UNITS = new Set(Object.values(UNIT_ALIASES));

/**
 * Normaliza a unidade para a forma canônica: aplica `normalizeName`
 * (UPPERCASE + sem acento) e depois o alias de→para. Retorna `null` para
 * vazio/nulo; unidade desconhecida passa direto (já normalizada).
 *
 * Trata ainda o sufixo "1" de ERP (`UN1`, `KG1`, `L1`, `CX1`…): colapsa na base
 * quando ela é uma unidade canônica conhecida. NÃO afeta `M2`/`M3`/`CX2…CX100`
 * (terminam em 2/3/…/0, não em 1) — distintos de propósito.
 */
export function normalizeUnit(value?: string | null): string | null {
  const n = normalizeName(value);
  if (!n) {
    return null;
  }
  if (UNIT_ALIASES[n]) {
    return UNIT_ALIASES[n];
  }
  if (n.endsWith('1') && CANONICAL_UNITS.has(n.slice(0, -1))) {
    return n.slice(0, -1);
  }
  return n;
}
