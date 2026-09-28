/**
 * Gera `src/data/municipios.json` a partir do dataset público
 * kelvins/municipios-brasileiros (MIT — https://github.com/kelvins/municipios-brasileiros),
 * que traz o código IBGE, nome e coordenadas (centróide) dos 5.570 municípios.
 *
 * Uso: `pnpm data:municipios` (precisa de rede). O JSON é commitado; rode de novo
 * só quando quiser atualizar a base. Formato compacto (linhas
 * `[ibge_code, nome, uf, lat, lng]`) para manter o arquivo pequeno.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h.trim()] = (cols[i] ?? '').trim();
    });
    return row;
  });
}

async function fetchCsv(name: string): Promise<Record<string, string>[]> {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) {
    throw new Error(`Falha ao baixar ${name}: HTTP ${res.status}`);
  }
  return parseCsv(await res.text());
}

async function main(): Promise<void> {
  const [estados, municipios] = await Promise.all([
    fetchCsv('estados.csv'),
    fetchCsv('municipios.csv'),
  ]);
  const ufByCode = new Map(estados.map((e) => [e.codigo_uf, e.uf]));

  const rows = municipios
    .map((m) => {
      const uf = ufByCode.get(m.codigo_uf);
      const lat = Number(m.latitude);
      const lng = Number(m.longitude);
      if (!uf || !m.codigo_ibge || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error(`Linha inválida: ${JSON.stringify(m)}`);
      }
      return [m.codigo_ibge, m.nome, uf, Number(lat.toFixed(4)), Number(lng.toFixed(4))] as const;
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  const out = join(import.meta.dirname, '..', 'src', 'data', 'municipios.json');
  writeFileSync(out, `${JSON.stringify(rows)}\n`);
  console.log(`municipios.json: ${rows.length} municípios gravados em ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
