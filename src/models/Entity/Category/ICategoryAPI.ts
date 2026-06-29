import type IEntityBase from '~/models/Entity/Base/IEntityBase';

interface ICategoryAPI extends IEntityBase {
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;

  format_updated_at?: string;
}

export default ICategoryAPI;
