import type IParamsRequest from '~/models/Request/Base/IParamsRequest';

interface IInvoiceParamsRequest extends IParamsRequest {
  type?: 'nfe' | 'nfse' | null;
  from?: string | null;
  to?: string | null;
}

export default IInvoiceParamsRequest;
