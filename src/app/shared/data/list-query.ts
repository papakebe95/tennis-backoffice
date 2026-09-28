import { HttpParams } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import type { TableLazyLoadEvent } from 'primeng/table';

/** Query of a server-side list: paging, sort, text search and filters. */
export interface ListQuery {
  page: number;
  pageSize: number;
  sort?: string;
  q?: string;
  filters: Record<string, string | undefined>;
}

export type ListPatch = Partial<Record<'page' | 'pageSize' | 'sort' | 'q' | string, string | number | null | undefined>>;

/**
 * List state kept in the URL (?page=2&status=ACTIVE…), so a filtered view can
 * be shared, bookmarked and survives a reload. Call in an injection context.
 */
export function injectListQuery(filterKeys: readonly string[], defaults: { pageSize?: number; sort?: string } = {}) {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const params = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });

  const query = computed<ListQuery>(() => parse(params(), filterKeys, defaults), {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  const update = (patch: ListPatch, resetPage = true) => {
    const queryParams: Record<string, string | number | null> = resetPage ? { page: null } : {};
    for (const [key, value] of Object.entries(patch)) {
      queryParams[key] = value === undefined || value === '' ? null : value;
    }
    return router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  };

  /**
   * p-table (lazy) paging → URL. Sorting is taken from onSort only: the
   * table also emits lazy-load events when its sort inputs are set from the
   * URL, and echoing those back would loop.
   */
  const onLazyLoad = (event: TableLazyLoadEvent) => {
    const current = query();
    const pageSize = event.rows ?? current.pageSize;
    const page = Math.floor((event.first ?? 0) / pageSize) + 1;
    if (page !== current.page || pageSize !== current.pageSize) {
      void update({ page: page === 1 ? null : page, pageSize: pageSize === (defaults.pageSize ?? 20) ? null : pageSize }, false);
    }
  };

  /**
   * p-table header click → URL (back to the first page). Tables run in
   * sortMode="multiple" bound to sortMeta(): a single input, so the events
   * the table emits when it is set from the URL match the URL and are no-ops
   * (with sortField + sortOrder it emits an intermediate, wrong order).
   */
  const onSort = (event: { field?: string; order?: number; multisortmeta?: { field: string; order: number }[] }) => {
    const meta = event.multisortmeta?.[0] ?? (event.field ? { field: event.field, order: event.order ?? 1 } : null);
    if (!meta) return;
    const sort = `${meta.field}:${meta.order === 1 ? 'asc' : 'desc'}`;
    if (sort !== query().sort) void update({ sort });
  };

  const hasFilters = computed(() => !!query().q || Object.values(query().filters).some(Boolean));
  const clearFilters = () =>
    update(Object.fromEntries([['q', null], ...filterKeys.map((key) => [key, null])]));

  /** The table's sort state, from the URL. */
  const sortMeta = computed(() => {
    const sort = query().sort;
    return sort ? [{ field: sort.split(':')[0], order: sort.endsWith(':asc') ? 1 : -1 }] : [];
  });
  const first = computed(() => (query().page - 1) * query().pageSize);

  return { query, update, onLazyLoad, onSort, hasFilters, clearFilters, sortMeta, first };
}

function parse(params: ParamMap, filterKeys: readonly string[], defaults: { pageSize?: number; sort?: string }): ListQuery {
  const positive = (value: string | null, fallback: number) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  return {
    page: positive(params.get('page'), 1),
    pageSize: Math.min(positive(params.get('pageSize'), defaults.pageSize ?? 20), 100),
    sort: params.get('sort') ?? defaults.sort,
    q: params.get('q') ?? undefined,
    filters: Object.fromEntries(filterKeys.map((key) => [key, params.get(key) ?? undefined])),
  };
}

/** The API's query string for a ListQuery (blank values omitted). */
export function toHttpParams(query: ListQuery): HttpParams {
  let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
  if (query.sort) params = params.set('sort', query.sort);
  if (query.q) params = params.set('q', query.q);
  for (const [key, value] of Object.entries(query.filters)) {
    if (value) params = params.set(key, value);
  }
  return params;
}
