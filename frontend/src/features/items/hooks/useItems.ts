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
 * useItems hook - Fetches items with filtering and pagination
 * Uses TanStack Query for caching and automatic refetching
 */
export function useItems({ filters, page, perPage }: UseItemsParams) {
  return useQuery({
    queryKey: queryKeys.items.list({ ...filters, page, perPage }),
    queryFn: () =>
      api.items.getItems({
        page,
        per_page: perPage,
        source: filters.sources.length === 1 ? filters.sources[0] : undefined,
        status: filters.status ?? undefined,
        search: filters.search || undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        // Sorting
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder,
        // Date range
        saved_after: filters.savedAfter ?? undefined,
        saved_before: filters.savedBefore ?? undefined,
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
