import type IEntityBase from '~/models/Entity/Base/IEntityBase';

interface ICompanyAPI extends IEntityBase {
  document: string;
  social_name: string;
  fantasy_name: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  origin: string;
  created_at: string;
  updated_at: string;

  format_document?: string;
}

export default ICompanyAPI;
