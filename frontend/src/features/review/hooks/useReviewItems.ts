import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ReviewSortBy, ReviewSource } from '@/types'

interface UseReviewItemsParams {
  subreddits: string[]
  sortBy: ReviewSortBy
  includeNsfw?: boolean
  includeBroken?: boolean
  sources?: ReviewSource[]
  enabled?: boolean
}

const PAGE_SIZE = 10

/**
 * Map sort option to backend sort parameters
 */
function getSortParams(sortBy: ReviewSortBy): { sort_by: string; sort_order: 'asc' | 'desc' } {
  switch (sortBy) {
    case 'score':
      return { sort_by: 'priority', sort_order: 'desc' }
    case 'recency':
      return { sort_by: 'saved_at', sort_order: 'desc' }
    case 'subreddit':
      // Sort by subreddit name (alphabetically), then by score within each
      return { sort_by: 'saved_at', sort_order: 'desc' } // Backend doesn't support subreddit sort, will group in frontend
    case 'random':
      // Random uses saved_at but frontend will shuffle
      return { sort_by: 'saved_at', sort_order: 'desc' }
    default:
      return { sort_by: 'saved_at', sort_order: 'desc' }
  }
}

/**
 * useReviewItems hook - Fetches review queue with infinite scrolling
 * Filters for items that are due for review with configurable options
 */
export function useReviewItems({
  subreddits,
  sortBy,
  includeNsfw = false,
  includeBroken = false,
  sources = ['reddit'],
  enabled = true,
}: UseReviewItemsParams) {
  const { sort_by, sort_order } = getSortParams(sortBy)

  return useInfiniteQuery({
    queryKey: ['review-items', { subreddits, sortBy, includeNsfw, includeBroken, sources }],
    queryFn: async ({ pageParam = 1 }) => {
      // Only apply subreddit filter when Reddit is in sources
      const isRedditSelected = sources.includes('reddit')
      const effectiveSubreddits = isRedditSelected && subreddits.length > 0
        ? subreddits
        : undefined

      const response = await api.items.getItems({
        page: pageParam,
        per_page: PAGE_SIZE,
        // Use sources array for multiple source filtering
        sources: sources.length > 0 ? sources : undefined,
        due_for_review: true,
        subreddits: effectiveSubreddits,
        sort_by: sort_by as any,
        sort_order,
        // NSFW and broken link filters (exclude by default)
        exclude_nsfw: !includeNsfw,
        exclude_broken: !includeBroken,
      })
      return response
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.has_next) {
        return lastPage.page + 1
      }
      return undefined
    },
    initialPageParam: 1,
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  })
}

export default useReviewItems
