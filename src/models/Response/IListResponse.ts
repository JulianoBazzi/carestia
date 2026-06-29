import type IMetaResponse from '~/models/Response/IMetaResponse';

interface IListResponse<T> {
  data: T[];
  meta: IMetaResponse;
}

export default IListResponse;
