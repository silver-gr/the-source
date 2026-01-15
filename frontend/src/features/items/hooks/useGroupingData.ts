import { useQuery } from '@tanstack/react-query'
import { itemsApi } from '@/lib/api-client'
import type { TagsResponse, DomainsResponse, SubredditsResponse } from '@/types'

/**
 * Query keys for grouping data
 */
export const groupingKeys = {
  all: ['grouping'] as const,
  tags: () => [...groupingKeys.all, 'tags'] as const,
  domains: () => [...groupingKeys.all, 'domains'] as const,
  subreddits: () => [...groupingKeys.all, 'subreddits'] as const,
}

/**
 * Fetch all tags with their item counts
 * Used for TagGroupSelector component
 */
export function useTagsWithCounts(options?: { enabled?: boolean }) {
  return useQuery<TagsResponse>({
    queryKey: groupingKeys.tags(),
    queryFn: () => itemsApi.getTagsWithCounts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  })
}

/**
 * Fetch all domains with their item counts
 * Used for WebsiteGroupSidebar component
 */
export function useDomainsWithCounts(options?: { enabled?: boolean }) {
  return useQuery<DomainsResponse>({
    queryKey: groupingKeys.domains(),
    queryFn: () => itemsApi.getDomainsWithCounts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  })
}

/**
 * Fetch all subreddits with their item counts
 * Used for SubredditGroupSidebar component
 */
export function useSubredditsWithCounts(options?: { enabled?: boolean }) {
  return useQuery<SubredditsResponse>({
    queryKey: groupingKeys.subreddits(),
    queryFn: () => itemsApi.getSubreddits(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  })
}

/**
 * Helper to compute available years from a date range
 * Returns years in descending order (most recent first)
 */
export function computeAvailableYears(startYear: number = 2020): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let year = currentYear; year >= startYear; year--) {
    years.push(year)
  }
  return years
}

/**
 * Get all months (1-12) for a dropdown
 */
export function getAllMonths(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1)
}

/**
 * Get month name from month number (1-12)
 */
export function getMonthName(month: number): string {
  const date = new Date(2000, month - 1)
  return date.toLocaleString('en-US', { month: 'long' })
}

export default useTagsWithCounts
