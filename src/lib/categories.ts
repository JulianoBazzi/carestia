export interface IDefaultCategory {
  name: string;
  slug: string;
}

export const DEFAULT_CATEGORIES: IDefaultCategory[] = [
  { name: 'Combustíveis', slug: 'combustiveis' },
  { name: 'Alimentação', slug: 'alimentacao' },
  { name: 'Serviços', slug: 'servicos' },
  { name: 'Saúde', slug: 'saude' },
  { name: 'Outros', slug: 'outros' },
];
