export interface IDefaultCategory {
  name: string;
  slug: string;
}

export const DEFAULT_CATEGORIES: IDefaultCategory[] = [
  { name: 'COMBUSTIVEIS', slug: 'combustiveis' },
  { name: 'ALIMENTACAO', slug: 'alimentacao' },
  { name: 'SERVICOS', slug: 'servicos' },
  { name: 'SAUDE', slug: 'saude' },
  { name: 'OUTROS', slug: 'outros' },
];
