import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-client'
import type { UpdateSavedItemRequest } from '@/types'

/**
 * useItemMutations hook - Provides mutations for item operations
 * Handles cache invalidation automatically
 */
export function useItemMutations() {
  const queryClient = useQueryClient()

  // Invalidate all items queries after mutations
  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.items.all })
  }

  /**
   * Mark item as read (processed)
   */
  const markAsRead = useMutation({
    mutationFn: (id: string) => api.items.markAsRead(id),
    onSuccess: () => {
      invalidateItems()
    },
  })

  /**
   * Archive item
   */
  const archiveItem = useMutation({
    mutationFn: (id: string) => api.items.archiveItem(id),
    onSuccess: () => {
      invalidateItems()
    },
  })

  /**
   * Delete item
   */
  const deleteItem = useMutation({
    mutationFn: (id: string) => api.items.deleteItem(id),
    onSuccess: () => {
      invalidateItems()
    },
  })

  /**
   * Update item
   */
  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedItemRequest }) =>
      api.items.updateItem(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific item and lists
      queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(variables.id) })
      invalidateItems()
    },
  })

  /**
   * Bulk mark as read
   */
  const bulkMarkAsRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map((id) => api.items.markAsRead(id)))
      return results
    },
    onSuccess: () => {
      invalidateItems()
    },
  })

  /**
   * Bulk archive
   */
  const bulkArchive = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map((id) => api.items.archiveItem(id)))
      return results
    },
    onSuccess: () => {
      invalidateItems()
    },
  })

  /**
   * Bulk delete
   */
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.items.deleteItem(id)))
    },
    onSuccess: () => {
      invalidateItems()
    },
  })

  return {
    markAsRead,
    archiveItem,
    deleteItem,
    updateItem,
    bulkMarkAsRead,
    bulkArchive,
    bulkDelete,
    // Convenience loading states
    isLoading:
      markAsRead.isPending ||
      archiveItem.isPending ||
      deleteItem.isPending ||
      bulkMarkAsRead.isPending ||
      bulkArchive.isPending ||
      bulkDelete.isPending,
  }
}

export default useItemMutations
