import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Check, Play, SortAsc, Timer, Shield, Link2Off, Globe, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useSubreddits } from '../hooks/useSubreddits'
import { api } from '@/lib/api-client'
import type { ReviewConfig, ReviewSortBy, ReviewSource } from '@/types'

interface ReviewConfigPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ReviewConfig
  onConfigChange: (config: ReviewConfig) => void
  onStart: () => void
}

/**
 * ReviewConfigPanel component - Configuration dialog for review session
 *
 * Features:
 * - Subreddit multi-select with checkboxes
 * - Sort by (score or recency)
 * - Timer duration setting
 * - Start button
 */
export function ReviewConfigPanel({
  open,
  onOpenChange,
  config,
  onConfigChange,
  onStart,
}: ReviewConfigPanelProps) {
  const { data: subredditsData, isLoading } = useSubreddits()
  const [localConfig, setLocalConfig] = useState(config)

  // Sync local state when config prop changes
  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  const toggleSubreddit = useCallback((subreddit: string) => {
    setLocalConfig((prev) => {
      const newSubreddits = prev.subreddits.includes(subreddit)
        ? prev.subreddits.filter((s) => s !== subreddit)
        : [...prev.subreddits, subreddit]
      return { ...prev, subreddits: newSubreddits }
    })
  }, [])

  const selectAllSubreddits = useCallback(() => {
    if (subredditsData?.subreddits) {
      setLocalConfig((prev) => ({
        ...prev,
        subreddits: subredditsData.subreddits.map((s) => s.subreddit),
      }))
    }
  }, [subredditsData])

  const clearAllSubreddits = useCallback(() => {
    setLocalConfig((prev) => ({ ...prev, subreddits: [] }))
  }, [])

  const handleSortChange = useCallback((value: ReviewSortBy) => {
    setLocalConfig((prev) => ({ ...prev, sortBy: value }))
  }, [])

  const handleTimerChange = useCallback((value: string) => {
    setLocalConfig((prev) => ({ ...prev, timerDuration: parseInt(value, 10) }))
  }, [])

  const handleNsfwToggle = useCallback((checked: boolean) => {
    setLocalConfig((prev) => ({ ...prev, includeNsfw: checked }))
  }, [])

  const handleBrokenToggle = useCallback((checked: boolean) => {
    setLocalConfig((prev) => ({ ...prev, includeBroken: checked }))
  }, [])

  const toggleSource = useCallback((source: ReviewSource) => {
    setLocalConfig((prev) => {
      const newSources = prev.sources.includes(source)
        ? prev.sources.filter((s) => s !== source)
        : [...prev.sources, source]
      // Ensure at least one source is selected
      if (newSources.length === 0) return prev
      return { ...prev, sources: newSources }
    })
  }, [])

  const handleStart = useCallback(() => {
    onConfigChange(localConfig)
    onStart()
    onOpenChange(false)
  }, [localConfig, onConfigChange, onStart, onOpenChange])

  // Dynamic count query based on current filter settings
  const { data: countData, isFetching: isCountLoading } = useQuery({
    queryKey: ['review-count', {
      sources: localConfig.sources,
      subreddits: localConfig.subreddits,
      includeNsfw: localConfig.includeNsfw,
      includeBroken: localConfig.includeBroken,
    }],
    queryFn: async () => {
      // Only apply subreddit filter when Reddit is selected as a source
      const isRedditSelected = localConfig.sources.includes('reddit')
      const effectiveSubreddits = isRedditSelected && localConfig.subreddits.length > 0
        ? localConfig.subreddits
        : undefined

      const response = await api.items.getItems({
        page: 1,
        per_page: 1, // We only need the total count
        // Use sources array when filtering by sources (supports 1 or more)
        sources: localConfig.sources.length > 0 ? localConfig.sources : undefined,
        due_for_review: true,
        subreddits: effectiveSubreddits,
        exclude_nsfw: !localConfig.includeNsfw,
        exclude_broken: !localConfig.includeBroken,
      })
      return response.total
    },
    enabled: open, // Only fetch when modal is open
    staleTime: 5000, // Cache for 5 seconds
  })

  const totalItems = countData ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-source-reddit flex items-center justify-center">
              <Play className="h-4 w-4 text-white" />
            </div>
            Reddit Review
          </DialogTitle>
          <DialogDescription>
            Configure your review session. Select subreddits to focus on specific content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sources - moved to top for better UX */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Sources
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleSource('reddit')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors border',
                  localConfig.sources.includes('reddit')
                    ? 'bg-source-reddit text-white border-source-reddit'
                    : 'border-input hover:bg-muted'
                )}
              >
                Reddit
              </button>
              <button
                type="button"
                onClick={() => toggleSource('youtube')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors border',
                  localConfig.sources.includes('youtube')
                    ? 'bg-source-youtube text-white border-source-youtube'
                    : 'border-input hover:bg-muted'
                )}
              >
                YouTube
              </button>
              <button
                type="button"
                onClick={() => toggleSource('raindrop')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors border',
                  localConfig.sources.includes('raindrop')
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'border-input hover:bg-muted'
                )}
              >
                Raindrop
              </button>
            </div>
          </div>

          {/* Subreddit Selection - only shown when Reddit is selected */}
          {localConfig.sources.includes('reddit') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Subreddits</label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllSubreddits}
                    className="h-7 text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllSubreddits}
                    className="h-7 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-md border border-white/10 p-2 space-y-1 config-scrollbar">
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </>
                ) : subredditsData?.subreddits.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No subreddits found. Sync some Reddit content first.
                  </p>
                ) : (
                  subredditsData?.subreddits.map((sub) => {
                    const isSelected =
                      localConfig.subreddits.length === 0 ||
                      localConfig.subreddits.includes(sub.subreddit)
                    return (
                      <button
                        key={sub.subreddit}
                        type="button"
                        onClick={() => toggleSubreddit(sub.subreddit)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                          isSelected
                            ? 'bg-source-reddit/10 text-source-reddit'
                            : 'hover:bg-muted'
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <div
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                              isSelected
                                ? 'bg-source-reddit border-source-reddit'
                                : 'border-input'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          r/{sub.subreddit}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {sub.count} items
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Sort By */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <SortAsc className="h-4 w-4" />
              Sort By
            </label>
            <Select value={localConfig.sortBy} onValueChange={handleSortChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Highest Score First</SelectItem>
                <SelectItem value="recency">Most Recent First</SelectItem>
                {localConfig.sources.includes('reddit') && (
                  <SelectItem value="subreddit">By Subreddit</SelectItem>
                )}
                <SelectItem value="random">Random Shuffle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timer Duration */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Timer Duration
            </label>
            <Select
              value={String(localConfig.timerDuration)}
              onValueChange={handleTimerChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 seconds</SelectItem>
                <SelectItem value="8">8 seconds (default)</SelectItem>
                <SelectItem value="10">10 seconds</SelectItem>
                <SelectItem value="15">15 seconds</SelectItem>
                <SelectItem value="20">20 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Options */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Advanced</p>

            {/* Include NSFW */}
            <div className="flex items-center justify-between">
              <label className="text-sm flex items-center gap-2 cursor-pointer">
                <Shield className="h-4 w-4 text-amber-500" />
                Include NSFW
              </label>
              <Switch
                checked={localConfig.includeNsfw}
                onCheckedChange={handleNsfwToggle}
              />
            </div>

            {/* Include Broken Links */}
            <div className="flex items-center justify-between">
              <label className="text-sm flex items-center gap-2 cursor-pointer">
                <Link2Off className="h-4 w-4 text-red-500" />
                Include Dead Links
              </label>
              <Switch
                checked={localConfig.includeBroken}
                onCheckedChange={handleBrokenToggle}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground flex-1 flex items-center gap-2">
            {isCountLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Counting...</span>
              </>
            ) : (
              <span>{totalItems.toLocaleString()} items to review</span>
            )}
          </div>
          <Button
            onClick={handleStart}
            disabled={totalItems === 0 || isCountLoading}
            className="bg-source-reddit hover:bg-source-reddit/90 text-white"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ReviewConfigPanel
