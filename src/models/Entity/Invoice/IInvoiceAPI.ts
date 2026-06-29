import type IEntityBase from '~/models/Entity/Base/IEntityBase';

interface IInvoiceAPI extends IEntityBase {
  model: 'nfe' | 'nfse';
  number: string;
  series: string | null;
  access_key: string;
  issued_at: string;
  total_value: number;
  company: {
    id: string;
    document: string;
    social_name: string;
    fantasy_name: string | null;
  };
  items_count: number;

  company_name?: string;
  format_document?: string;
  format_issued_at?: string;
  format_total?: string;
}

export default IInvoiceAPI;
