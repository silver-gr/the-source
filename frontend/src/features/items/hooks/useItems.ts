import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-client'
import type { FilterState } from '@/types'

interface UseItemsParams {
  filters: FilterState
  page: number
  perPage: number
}

/**
 * Helper to compute date range from year and month
 */
function computeDateRangeFromYearMonth(
  year: number | null,
  month: number | null
): { savedAfter: string | null; savedBefore: string | null } {
  if (!year) {
    return { savedAfter: null, savedBefore: null }
  }

  if (month) {
    // Specific month in year
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999) // Last day of month
    return {
      savedAfter: startDate.toISOString(),
      savedBefore: endDate.toISOString(),
    }
  } else {
    // Whole year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999)
    return {
      savedAfter: startDate.toISOString(),
      savedBefore: endDate.toISOString(),
    }
  }
}

/**
 * useItems hook - Fetches items with filtering and pagination
 * Uses TanStack Query for caching and automatic refetching
 * Supports grouping filters: date (year/month), tag, and domain
 */
export function useItems({ filters, page, perPage }: UseItemsParams) {
  // Compute effective date range: grouping overrides manual date range
  const dateRange =
    filters.groupBy === 'date' && filters.groupYear
      ? computeDateRangeFromYearMonth(filters.groupYear, filters.groupMonth)
      : { savedAfter: filters.savedAfter, savedBefore: filters.savedBefore }

  // Compute effective tags: groupTag overrides manual tags
  const effectiveTags =
    filters.groupBy === 'tags' && filters.groupTag
      ? [filters.groupTag]
      : filters.tags.length > 0
        ? filters.tags
        : undefined

  // Domain filter for website grouping
  const effectiveDomain =
    filters.groupBy === 'website' && filters.groupDomain
      ? filters.groupDomain
      : undefined

  return useQuery({
    queryKey: queryKeys.items.list({ ...filters, page, perPage }),
    queryFn: () =>
      api.items.getItems({
        page,
        per_page: perPage,
        source: filters.sources.length === 1 ? filters.sources[0] : undefined,
        status: filters.status ?? undefined,
        search: filters.search || undefined,
        tags: effectiveTags,
        domain: effectiveDomain,
        // Sorting
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder,
        // Date range
        saved_after: dateRange.savedAfter ?? undefined,
        saved_before: dateRange.savedBefore ?? undefined,
      }),
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  })
}

/**
 * useItemsSuspense hook - Suspense version for Suspense boundaries
 * Use this with React Suspense for better loading UX
 */
export function useItemsSuspense({ filters, page, perPage }: UseItemsParams) {
  return useSuspenseQuery({
    queryKey: queryKeys.items.list({ ...filters, page, perPage }),
    queryFn: () =>
      api.items.getItems({
        page,
        per_page: perPage,
        source: filters.sources.length === 1 ? filters.sources[0] : undefined,
        status: filters.status ?? undefined,
        search: filters.search || undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
      }),
  })
}

/**
 * useItem hook - Fetches a single item by ID
 */
export function useItem(id: string) {
  return useQuery({
    queryKey: queryKeys.items.detail(id),
    queryFn: () => api.items.getItem(id),
    enabled: !!id,
  })
}

/**
 * useItemSuspense hook - Suspense version for single item
 */
export function useItemSuspense(id: string) {
  return useSuspenseQuery({
    queryKey: queryKeys.items.detail(id),
    queryFn: () => api.items.getItem(id),
  })
}

/**
 * useRecentItems hook - Fetches recent unprocessed items for dashboard
 */
export function useRecentItems(limit: number = 5) {
  return useQuery({
    queryKey: queryKeys.items.list({ status: 'unprocessed', limit }),
    queryFn: () =>
      api.items.getItems({
        per_page: limit,
        status: 'unprocessed',
      }),
  })
}

/**
 * useItemsStats hook - Fetches items for calculating stats
 */
export function useItemsStats() {
  return useQuery({
    queryKey: queryKeys.items.lists(),
    queryFn: () =>
      api.items.getItems({
        per_page: 100, // Fetch enough to calculate meaningful stats
      }),
  })
}

export default useItems
