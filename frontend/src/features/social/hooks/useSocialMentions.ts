// frontend/src/features/social/hooks/useSocialMentions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { socialApi } from '@/lib/api-client'
import type { SocialCheckResponse } from '@/types'

/**
 * Query key factory for social mentions
 */
export const socialKeys = {
  all: ['social'] as const,
  mentions: (itemId: string) => [...socialKeys.all, 'mentions', itemId] as const,
}

/**
 * Hook to get cached social mentions for an item
 */
export function useSocialMentions(itemId: string | null) {
  return useQuery({
    queryKey: socialKeys.mentions(itemId ?? ''),
    queryFn: () => socialApi.getSocialMentions(itemId!),
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to check social presence (makes API calls)
 */
export function useCheckSocial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, refresh = false }: { itemId: string; refresh?: boolean }) =>
      socialApi.checkSocial(itemId, refresh),
    onSuccess: (data, { itemId }) => {
      // Update cache with new data
      queryClient.setQueryData(socialKeys.mentions(itemId), data)
    },
  })
}

/**
 * Hook to batch check social presence
 */
export function useBatchCheckSocial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemIds: string[]) => socialApi.batchCheckSocial(itemIds),
    onSuccess: (data) => {
      // Update cache for each item
      Object.entries(data.results).forEach(([itemId, result]) => {
        queryClient.setQueryData(socialKeys.mentions(itemId), result)
      })
    },
  })
}

/**
 * Helper to check if an item has any social mentions
 */
export function hasSocialMentions(data: SocialCheckResponse | undefined): boolean {
  if (!data) return false
  return data.hackernews.length > 0 || data.reddit.length > 0
}

/**
 * Helper to get total engagement score
 */
export function getTotalEngagement(data: SocialCheckResponse | undefined): number {
  if (!data) return 0
  const hnScore = data.hackernews.reduce((sum, m) => sum + m.score, 0)
  const redditScore = data.reddit.reduce((sum, m) => sum + m.score, 0)
  return hnScore + redditScore
}
