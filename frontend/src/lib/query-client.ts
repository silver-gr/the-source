import { QueryClient } from '@tanstack/react-query'

/**
 * TanStack Query client with optimized defaults
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: How long data is considered fresh (5 minutes)
      staleTime: 5 * 60 * 1000,
      // Cache time: How long inactive data stays in cache (30 minutes)
      gcTime: 30 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default (can be overridden per query)
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
})

/**
 * Query key factory for type-safe and consistent query keys
 * Following the factory pattern recommended by TanStack Query
 */
export const queryKeys = {
  // Items queries
  items: {
    all: ['items'] as const,
    lists: () => [...queryKeys.items.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.items.lists(), filters] as const,
    details: () => [...queryKeys.items.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.items.details(), id] as const,
  },

  // Sync queries
  sync: {
    all: ['sync'] as const,
    status: () => [...queryKeys.sync.all, 'status'] as const,
    sourceStatus: (source: string) =>
      [...queryKeys.sync.status(), source] as const,
  },

  // Tags queries
  tags: {
    all: ['tags'] as const,
    list: () => [...queryKeys.tags.all, 'list'] as const,
  },
} as const

/**
 * Type helper for extracting query key types
 */
export type QueryKeys = typeof queryKeys
