import type IEntityBase from '~/models/Entity/Base/IEntityBase';

interface IItemAPI extends IEntityBase {
  type: 'product' | 'service';
  reference_code: string;
  name: string;
  unit: string | null;
  nbs_code: string | null;
  category_id: string | null;
  category: { id: string; name: string } | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export default IItemAPI;
