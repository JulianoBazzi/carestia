export interface IDefaultCategory {
  name: string;
  slug: string;
}

export const DEFAULT_CATEGORIES: IDefaultCategory[] = [
  { name: 'COMBUSTIVEIS', slug: 'fuel' },
  { name: 'ALIMENTACAO', slug: 'food' },
  { name: 'SERVICOS', slug: 'services' },
  { name: 'SAUDE', slug: 'health' },
  { name: 'ENERGIA', slug: 'energy' },
  { name: 'MORADIA', slug: 'housing' },
  { name: 'TRANSPORTE', slug: 'transport' },
  { name: 'EDUCACAO', slug: 'education' },
  { name: 'COMUNICACAO', slug: 'communication' },
  { name: 'VESTUARIO', slug: 'clothing' },
  { name: 'CASA', slug: 'household' },
  { name: 'HIGIENE', slug: 'hygiene' },
  { name: 'LAZER', slug: 'leisure' },
  { name: 'OUTROS', slug: 'other' },
];
