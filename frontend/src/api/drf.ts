// Small helpers for DRF list endpoints (PageNumberPagination + Search/OrderingFilter)

export type ApiPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type BuildDrfListParamsArgs = {
  /** Search text (mapped to DRF SearchFilter param: `search`) */
  search?: string;
  /** DRF OrderingFilter param value (e.g. `name` or `-updated_at`) */
  ordering?: string;
  /** Optional mapping from UI/order keys to API ordering fields (supports -prefix) */
  orderingMap?: Record<string, string>;
  /** DataGrid 0-based page index */
  page0?: number;
  /** Page size */
  pageSize?: number;
  /** Include soft-deleted rows */
  includeDeleted?: boolean;
  /** Only soft-deleted rows */
  onlyDeleted?: boolean;
  /** Extra filter params to pass through (e.g. `{ status: 3, customer: 10 }`) */
  extra?: Record<string, any>;
};

export function includeDeletedParams(includeDeleted: boolean) {
  return includeDeleted ? { include_deleted: 1 } : null;
}

/**
 * Build DRF query params for list endpoints.
 * - PageNumberPagination: `page` is 1-based
 * - SearchFilter uses `search` param
 */
export function buildDrfListParams(args: BuildDrfListParamsArgs) {
  const params: Record<string, any> = {
    ...(args.extra ?? {}),
  };

  const search = (args.search ?? "").trim();
  if (search) params.search = search;

  const orderingRaw = (args.ordering ?? "").trim();
  if (orderingRaw) {
    const desc = orderingRaw.startsWith("-");
    const field = desc ? orderingRaw.slice(1) : orderingRaw;
    const mapped = (args.orderingMap && args.orderingMap[field]) || field;
    params.ordering = desc ? `-${mapped}` : mapped;
  }

  if (typeof args.page0 === "number") params.page = args.page0 + 1;
  if (typeof args.pageSize === "number") params.page_size = args.pageSize;

  if (args.onlyDeleted) {
    params.only_deleted = 1;
    params.include_deleted = 1;
  } else if (args.includeDeleted) {
    params.include_deleted = 1;
  }

  return params;
}
