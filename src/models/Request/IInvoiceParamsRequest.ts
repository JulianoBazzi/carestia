import type IParamsRequest from '~/models/Request/Base/IParamsRequest';

interface IInvoiceParamsRequest extends IParamsRequest {
  type?: 'nfe' | 'nfce' | 'nfse' | 'nf3e' | null;
  from?: string | null;
  to?: string | null;
  company?: string | null;
}

export default IInvoiceParamsRequest;
