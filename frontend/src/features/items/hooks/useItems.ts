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

  // Subreddit filter for subreddit grouping
  const effectiveSubreddit =
    filters.groupBy === 'subreddit' && filters.groupSubreddit
      ? filters.groupSubreddit
      : undefined

  // Link filter: working = exclude broken, broken = only broken
  const linkStatusFilter =
    filters.linkFilter === 'broken' ? 'broken' as const : undefined
  const excludeBrokenLinks = filters.linkFilter === 'working'

  // NSFW filter: safe = exclude nsfw/explicit, nsfw = only nsfw/explicit
  const nsfwStatusFilter =
    filters.nsfwFilter === 'nsfw' ? 'nsfw' as const : undefined
  const excludeNsfwContent = filters.nsfwFilter === 'safe'

  return useQuery({
    queryKey: queryKeys.items.list({ ...filters, page, perPage }),
    queryFn: () =>
      api.items.getItems({
        page,
        per_page: perPage,
        // Use sources array when filtering by sources (supports 1 or more)
        sources: filters.sources.length > 0 ? filters.sources : undefined,
        status: filters.status ?? undefined,
        search: filters.search || undefined,
        tags: effectiveTags,
        domain: effectiveDomain,
        subreddit: effectiveSubreddit,
        // Sorting
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder,
        // Date range
        saved_after: dateRange.savedAfter ?? undefined,
        saved_before: dateRange.savedBefore ?? undefined,
        // Link health filter
        link_status: linkStatusFilter,
        exclude_broken: excludeBrokenLinks || undefined,
        // NSFW filter
        nsfw_status: nsfwStatusFilter,
        exclude_nsfw: excludeNsfwContent || undefined,
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
        // Use sources array when filtering by sources (supports 1 or more)
        sources: filters.sources.length > 0 ? filters.sources : undefined,
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
 * useItemStats hook - Fetches item statistics from the API
 * Returns total counts and counts per source
 */
export function useItemStats() {
  return useQuery({
    queryKey: ['items', 'stats'],
    queryFn: () => api.items.getStats(),
    staleTime: 30 * 1000, // 30 seconds - stats don't need to be super fresh
  })
}

export default useItems
