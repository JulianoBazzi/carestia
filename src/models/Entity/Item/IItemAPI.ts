import type IEntityBase from '~/models/Entity/Base/IEntityBase';

interface IItemAPI extends IEntityBase {
  type: 'product' | 'service';
  reference_code: string;
  name: string;
  unit: string | null;
  ean: string | null;
  nbs_code: string | null;
  category_id: string | null;
  category: { id: string; name: string } | null;
  usage_count: number;
  /** Média do preço unitário nos últimos 12 meses (todas as notas); null sem dados. */
  avg_price: number | null;
  price_samples: number;
  /** Data da nota mais recente que precificou o item na janela. */
  last_price_at: string | null;
  created_at: string;
  updated_at: string;
}

export default IItemAPI;
