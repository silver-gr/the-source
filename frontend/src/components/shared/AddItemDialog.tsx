import { useState, useCallback } from 'react'
import { Link2, Plus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { itemsApi } from '@/lib/api-client'

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * AddItemDialog - Simple dialog to manually add a URL
 * Creates item with source='manual' and fetches title automatically
 */
export function AddItemDialog({ open, onOpenChange }: AddItemDialogProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString()
      return itemsApi.createItem({
        source: 'manual',
        source_id: `manual-${Date.now()}`,
        url: url.trim(),
        title: title.trim() || url.trim(), // Use URL as title if not provided
        created_at: now,
        saved_at: now,
      })
    },
    onSuccess: () => {
      // Invalidate items query to refresh list
      queryClient.invalidateQueries({ queryKey: ['items'] })
      // Reset form and close
      setUrl('')
      setTitle('')
      onOpenChange(false)
    },
  })

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    createMutation.mutate()
  }, [url, createMutation])

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      setUrl('')
      setTitle('')
      onOpenChange(false)
    }
  }, [createMutation.isPending, onOpenChange])

  const isValidUrl = (str: string) => {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  const canSubmit = url.trim() && isValidUrl(url.trim()) && !createMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Link
          </DialogTitle>
          <DialogDescription>
            Add a URL to save for later. Title will be fetched automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* URL Input */}
          <div className="space-y-2">
            <label htmlFor="url" className="text-sm font-medium">
              URL <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10"
                autoFocus
                disabled={createMutation.isPending}
              />
            </div>
            {url && !isValidUrl(url) && (
              <p className="text-xs text-destructive">Please enter a valid URL</p>
            )}
          </div>

          {/* Optional Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="title"
              type="text"
              placeholder="Leave empty to auto-fetch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={createMutation.isPending}
            />
          </div>

          {/* Error */}
          {createMutation.isError && (
            <p className="text-sm text-destructive">
              Failed to add item. Please try again.
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddItemDialog
