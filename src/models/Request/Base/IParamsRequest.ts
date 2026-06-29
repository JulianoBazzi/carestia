export enum OrderByTypeEnum {
  Asc = 'asc',
  Desc = 'desc',
}

interface IParamsRequest {
  search?: string | null;
  page?: number;
  perPage?: number;
  orderBy?: string | null;
  sortedBy?: OrderByTypeEnum;
}

export default IParamsRequest;
