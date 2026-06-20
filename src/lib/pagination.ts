export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function parsePagination(
  query: { page?: string; pageSize?: string },
  defaults: { pageSize?: number; maxPageSize?: number } = {}
): Pagination {
  const defaultPageSize = defaults.pageSize ?? 50;
  const maxPageSize = defaults.maxPageSize ?? 100;
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const requestedPageSize = Number.parseInt(query.pageSize ?? String(defaultPageSize), 10) || defaultPageSize;
  const pageSize = Math.min(Math.max(requestedPageSize, 1), maxPageSize);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function pageCount(total: number, pageSize: number) {
  return Math.max(Math.ceil(total / pageSize), 1);
}
