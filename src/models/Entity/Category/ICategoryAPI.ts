import type IEntityBase from '~/models/Entity/Base/IEntityBase';

interface ICategoryAPI extends IEntityBase {
  name: string;
  slug: string;
  active: boolean;
  /** Chave do registry em `~/lib/category-icons`. */
  icon?: string | null;
  /** colorPalette do Chakra. */
  color?: string | null;
  items_count?: number;
  created_at: string;
  updated_at: string;

  format_updated_at?: string;
}

export default ICategoryAPI;
