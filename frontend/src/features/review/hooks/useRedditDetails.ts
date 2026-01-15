import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { RedditPostDetails } from '@/types'

interface UseRedditDetailsParams {
  itemId: string | null
  enabled?: boolean
}

/**
 * useRedditDetails hook - Fetches Reddit post details including comments
 *
 * Returns the full post content (selftext), score, author, subreddit,
 * and top 5 comments for rich display in the story view.
 */
export function useRedditDetails({ itemId, enabled = true }: UseRedditDetailsParams) {
  return useQuery<RedditPostDetails>({
    queryKey: ['reddit-details', itemId],
    queryFn: async () => {
      if (!itemId) {
        throw new Error('Item ID is required')
      }
      return api.items.getRedditDetails(itemId)
    },
    enabled: enabled && !!itemId,
    staleTime: 8 * 24 * 60 * 60 * 1000, // 8 days - data is cached in DB after archive
    gcTime: 8 * 24 * 60 * 60 * 1000, // Keep in cache for 8 days
    retry: 2, // Retry twice on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })
}

export default useRedditDetails
