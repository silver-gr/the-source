import { useCallback } from 'react'
import { Check, Archive, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BulkActionsProps {
  selectedIds: Set<string>
  onMarkRead: (ids: string[]) => void
  onArchive: (ids: string[]) => void
  onDelete: (ids: string[]) => void
  onClearSelection: () => void
  isLoading?: boolean
}

/**
 * BulkActions component - Floating action bar for bulk operations
 * Features:
 * - Appears when items are selected
 * - Shows count of selected items
 * - Buttons: Mark Read, Archive, Delete
 * - Clear selection button
 * - Smooth slide-up animation
 */
export function BulkActions({
  selectedIds,
  onMarkRead,
  onArchive,
  onDelete,
  onClearSelection,
  isLoading = false,
}: BulkActionsProps) {
  const selectedCount = selectedIds.size
  const selectedArray = Array.from(selectedIds)

  const handleMarkRead = useCallback(() => {
    onMarkRead(selectedArray)
  }, [selectedArray, onMarkRead])

  const handleArchive = useCallback(() => {
    onArchive(selectedArray)
  }, [selectedArray, onArchive])

  const handleDelete = useCallback(() => {
    onDelete(selectedArray)
  }, [selectedArray, onDelete])

  // Don't render if nothing selected
  if (selectedCount === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
        'animate-in slide-in-from-bottom-4 fade-in duration-200'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-full bg-background/95 px-4 py-3',
          'border shadow-lg backdrop-blur-sm',
          'ring-1 ring-border/50'
        )}
      >
        {/* Selection Count */}
        <div className="flex items-center gap-2 border-r pr-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {selectedCount}
          </div>
          <span className="text-sm font-medium">
            {selectedCount === 1 ? 'item' : 'items'} selected
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkRead}
            disabled={isLoading}
            className="gap-1.5 hover:bg-green-500/10 hover:text-green-600"
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Mark Read</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchive}
            disabled={isLoading}
            className="gap-1.5 hover:bg-blue-500/10 hover:text-blue-600"
          >
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Archive</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isLoading}
            className="gap-1.5 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>

        {/* Clear Selection */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          disabled={isLoading}
          className="ml-1 h-8 w-8 rounded-full hover:bg-muted"
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default BulkActions
