export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

/** Returns the SQL OFFSET for the given page/limit. */
export function getOffset(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  return { data, page: params.page, limit: params.limit, total };
}
