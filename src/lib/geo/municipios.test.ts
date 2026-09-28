// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  findMunicipioByIbge,
  findMunicipioByName,
  isInBrazil,
  nearestMunicipio,
} from '~/lib/geo/municipios';

describe('nearestMunicipio', () => {
  it('resolve capitais pelo centróide mais próximo', () => {
    expect(nearestMunicipio(-23.5505, -46.6333).ibge_code).toBe('3550308'); // São Paulo
    expect(nearestMunicipio(-30.0346, -51.2177).ibge_code).toBe('4314902'); // Porto Alegre
    expect(nearestMunicipio(-15.7939, -47.8828).uf).toBe('DF'); // Brasília
  });
});

describe('findMunicipioByName', () => {
  it('casa nome com/sem acento e caixa, dentro da UF', () => {
    expect(findMunicipioByName('sp', 'são paulo')?.ibge_code).toBe('3550308');
    expect(findMunicipioByName('RS', 'PORTO ALEGRE')?.ibge_code).toBe('4314902');
    expect(findMunicipioByName('SP', 'PORTO ALEGRE')).toBeUndefined();
    expect(findMunicipioByName(null, 'X')).toBeUndefined();
  });
});

describe('findMunicipioByIbge', () => {
  it('devolve nome e UF', () => {
    expect(findMunicipioByIbge('4314902')).toMatchObject({ name: 'Porto Alegre', uf: 'RS' });
    expect(findMunicipioByIbge('0000000')).toBeUndefined();
  });
});

describe('isInBrazil', () => {
  it('aceita coordenadas no país e rejeita fora', () => {
    expect(isInBrazil(-23.55, -46.63)).toBe(true);
    expect(isInBrazil(48.85, 2.35)).toBe(false);
  });
});
