import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * useSubreddits hook - Fetches all subreddits with item counts for review configuration
 */
export function useSubreddits() {
  return useQuery({
    queryKey: ['subreddits'],
    queryFn: () => api.items.getSubreddits(),
    staleTime: 60 * 1000, // 1 minute - subreddits don't change often
  })
}

export default useSubreddits
