import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ReviewAction, RedditPostDetails } from '@/types'

interface ReviewMutationParams {
  id: string
  action: ReviewAction
  redditDetails?: RedditPostDetails
}

/**
 * useReviewActions hook - Mutations for review actions
 *
 * Actions:
 * - tomorrow: Schedule for tomorrow (+1 day)
 * - week: Schedule for next week (+7 days)
 * - archive: Archive and schedule far future (+30 days), saves reddit_details to DB
 * - read_now: Pause timer, open link (no schedule change)
 */
export function useReviewActions() {
  const queryClient = useQueryClient()

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, redditDetails }: ReviewMutationParams) =>
      api.items.reviewItem(id, action, redditDetails),
    onSuccess: () => {
      // Invalidate review items to refresh the queue
      queryClient.invalidateQueries({ queryKey: ['review-items'] })
      // Also invalidate regular items list
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  const scheduleTomorrow = (id: string, redditDetails?: RedditPostDetails) =>
    reviewMutation.mutateAsync({ id, action: 'tomorrow', redditDetails })

  const scheduleWeek = (id: string, redditDetails?: RedditPostDetails) =>
    reviewMutation.mutateAsync({ id, action: 'week', redditDetails })

  const archive = (id: string, redditDetails?: RedditPostDetails) =>
    reviewMutation.mutateAsync({ id, action: 'archive', redditDetails })

  const readNow = (id: string) =>
    reviewMutation.mutateAsync({ id, action: 'read_now' })

  return {
    scheduleTomorrow,
    scheduleWeek,
    archive,
    readNow,
    isLoading: reviewMutation.isPending,
    error: reviewMutation.error,
  }
}

export default useReviewActions
