import { useState, useCallback, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { X, ChevronLeft, ChevronRight, Loader2, Play, Pause } from 'lucide-react'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import { StoryProgress } from './StoryProgress'
import { StoryTimer } from './StoryTimer'
import { StoryCard } from './StoryCard'
import { StoryActions } from './StoryActions'
import { useReviewItems } from '../hooks/useReviewItems'
import { useReviewTimer } from '../hooks/useReviewTimer'
import { useReviewActions } from '../hooks/useReviewActions'
import { useRedditDetails } from '../hooks/useRedditDetails'
import type { ReviewConfig, SavedItem } from '@/types'

interface StoryReviewViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ReviewConfig
}

/**
 * StoryReviewView component - Full-screen Instagram story experience
 *
 * Features:
 * - Full-screen dark overlay
 * - Progress bar at top (Instagram-style)
 * - Timer indicator
 * - Card with content + Reddit details (selftext, comments)
 * - Action buttons at bottom
 * - Left/right navigation areas
 * - Touch/mouse interaction pauses timer
 */
export function StoryReviewView({ open, onOpenChange, config }: StoryReviewViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isManuallyPaused, setIsManuallyPaused] = useState(false)

  // Fetch review items
  const {
    data: reviewData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingItems,
  } = useReviewItems({
    subreddits: config.subreddits,
    sortBy: config.sortBy,
    includeNsfw: config.includeNsfw,
    includeBroken: config.includeBroken,
    sources: config.sources,
    enabled: open,
  })

  // Flatten all pages into a single array and apply frontend sorting
  const allItems: SavedItem[] = useMemo(() => {
    if (!reviewData?.pages) return []
    const items = reviewData.pages.flatMap((page) => page.items)

    // Apply frontend sorting for special sort modes
    if (config.sortBy === 'subreddit') {
      // Group by subreddit, then sort by score within each group
      return [...items].sort((a, b) => {
        const subA = a.subreddit || ''
        const subB = b.subreddit || ''
        if (subA !== subB) return subA.localeCompare(subB)
        // Within same subreddit, sort by score (descending)
        return (b.score || 0) - (a.score || 0)
      })
    }

    if (config.sortBy === 'random') {
      // Seeded shuffle based on current date (consistent within a session)
      const seed = new Date().toDateString()
      return [...items].sort(() => {
        // Simple deterministic shuffle using string hash
        const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        return Math.sin(hash * Math.random()) - 0.5
      })
    }

    return items
  }, [reviewData, config.sortBy])

  const totalItems = reviewData?.pages[0]?.total ?? 0
  const currentItem = allItems[currentIndex]

  // Fetch Reddit details for current item
  const {
    data: redditDetails,
    isLoading: isLoadingDetails,
  } = useRedditDetails({
    itemId: currentItem?.id ?? null,
    enabled: open && !!currentItem && currentItem.source === 'reddit',
  })

  // Review actions
  const { scheduleTomorrow, scheduleWeek, archive, readNow, isLoading: isActioning } =
    useReviewActions()

  // Move to next item
  const goToNext = useCallback(() => {
    if (currentIndex < allItems.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else if (hasNextPage && !isFetchingNextPage) {
      // Fetch more if available
      fetchNextPage()
    } else {
      // End of queue
      onOpenChange(false)
    }
  }, [currentIndex, allItems.length, hasNextPage, isFetchingNextPage, fetchNextPage, onOpenChange])

  // Go to previous item
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }, [currentIndex])

  // Timer
  const timer = useReviewTimer({
    duration: config.timerDuration,
    onComplete: goToNext,
  })

  // Reset timer when item changes
  useEffect(() => {
    if (currentItem) {
      timer.reset()
    }
  }, [currentIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch next page when approaching end
  useEffect(() => {
    if (currentIndex >= allItems.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [currentIndex, allItems.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Handle action: Tomorrow
  const handleTomorrow = useCallback(async () => {
    if (!currentItem) return
    timer.pause()
    try {
      // Pass reddit details to cache them in DB
      await scheduleTomorrow(currentItem.id, redditDetails ?? undefined)
      goToNext()
    } catch (error) {
      console.error('Failed to schedule tomorrow:', error)
      timer.resume()
    }
  }, [currentItem, timer, scheduleTomorrow, goToNext, redditDetails])

  // Handle action: Week
  const handleWeek = useCallback(async () => {
    if (!currentItem) return
    timer.pause()
    try {
      // Pass reddit details to cache them in DB
      await scheduleWeek(currentItem.id, redditDetails ?? undefined)
      goToNext()
    } catch (error) {
      console.error('Failed to schedule week:', error)
      timer.resume()
    }
  }, [currentItem, timer, scheduleWeek, goToNext, redditDetails])

  // Handle action: Archive
  const handleArchive = useCallback(async () => {
    if (!currentItem) return
    timer.pause()
    try {
      // Pass reddit details to cache them in DB for archived items
      await archive(currentItem.id, redditDetails ?? undefined)
      goToNext()
    } catch (error) {
      console.error('Failed to archive:', error)
      timer.resume()
    }
  }, [currentItem, timer, archive, goToNext, redditDetails])

  // Handle action: Read Now
  const handleReadNow = useCallback(async () => {
    if (!currentItem?.url) return
    timer.pause()
    // Open in new tab
    window.open(currentItem.url, '_blank', 'noopener,noreferrer')
    try {
      await readNow(currentItem.id)
      // Don't auto-advance, let user decide when to continue
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
    // Resume timer after 2 seconds
    timer.resume()
  }, [currentItem, timer, readNow])

  // Toggle pause/play manually
  const handleTogglePause = useCallback(() => {
    if (isManuallyPaused) {
      setIsManuallyPaused(false)
      timer.resume()
    } else {
      setIsManuallyPaused(true)
      timer.pause()
    }
  }, [isManuallyPaused, timer])

  // Handle interaction start (pause timer) - only if not manually paused
  const handleInteractionStart = useCallback(() => {
    if (!isManuallyPaused) {
      timer.pause()
    }
  }, [timer, isManuallyPaused])

  // Handle interaction end (schedule resume) - only if not manually paused
  const handleInteractionEnd = useCallback(() => {
    if (!isManuallyPaused) {
      timer.resume()
    }
  }, [timer, isManuallyPaused])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious()
          break
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          goToNext()
          break
        case 'Escape':
          onOpenChange(false)
          break
        case '1':
          handleTomorrow()
          break
        case '2':
          handleWeek()
          break
        case '3':
          handleArchive()
          break
        case 'Enter':
          handleReadNow()
          break
        case 'p':
        case 'P':
          handleTogglePause()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, goToNext, goToPrevious, onOpenChange, handleTomorrow, handleWeek, handleArchive, handleReadNow, handleTogglePause])

  // Reset index when dialog opens - key prop approach used instead
  // The Dialog component naturally resets state when closed/opened

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-[1800px] h-[92vh] p-0 border border-white/[0.08] rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 overflow-hidden shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        onPointerDown={handleInteractionStart}
        onPointerUp={handleInteractionEnd}
        onPointerLeave={handleInteractionEnd}
      >
        <VisuallyHidden>
          <DialogTitle>Reddit Review</DialogTitle>
        </VisuallyHidden>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-50 h-10 w-10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Loading state */}
        {isLoadingItems ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-white/60" />
          </div>
        ) : allItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-white">
            <p className="text-xl">No items to review!</p>
            <p className="text-white/60">All caught up, or try different filters.</p>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="mt-4 border-white/30 text-white hover:bg-white/10"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Top section: Progress + Timer - glass effect */}
            <div className="absolute top-0 left-0 right-0 z-40 space-y-3 pt-4 pb-6 bg-gradient-to-b from-zinc-900/80 via-zinc-900/50 to-transparent backdrop-blur-md">
              <StoryProgress
                total={totalItems}
                current={currentIndex}
                currentProgress={timer.progress}
              />
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  {/* Pause/Play button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTogglePause}
                    className={cn(
                      'h-10 w-10 rounded-xl p-0 transition-all duration-200',
                      isManuallyPaused
                        ? 'bg-source-reddit text-white shadow-lg shadow-source-reddit/30 hover:bg-source-reddit/90'
                        : 'bg-white/10 text-white/80 ring-1 ring-white/10 hover:bg-white/20 hover:text-white'
                    )}
                  >
                    {isManuallyPaused ? (
                      <Play className="h-5 w-5 ml-0.5" />
                    ) : (
                      <Pause className="h-5 w-5" />
                    )}
                  </Button>
                  <StoryTimer
                    timeRemaining={timer.timeRemaining}
                    isRunning={timer.isRunning && !isManuallyPaused}
                    isPaused={timer.isPaused || isManuallyPaused}
                  />
                </div>
                <span className="text-white/50 text-sm font-medium tabular-nums">
                  {currentIndex + 1} / {totalItems}
                </span>
              </div>
            </div>

            {/* Main content area with navigation zones */}
            <div className="relative h-full">
              {/* Left navigation zone */}
              <button
                type="button"
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                className={cn(
                  'absolute left-0 top-0 z-30 h-full w-1/4 flex items-center justify-start pl-4',
                  'opacity-0 hover:opacity-100 transition-opacity',
                  currentIndex === 0 && 'cursor-not-allowed'
                )}
                aria-label="Previous item"
              >
                {currentIndex > 0 && (
                  <ChevronLeft className="h-10 w-10 text-white/60" />
                )}
              </button>

              {/* Right navigation zone */}
              <button
                type="button"
                onClick={goToNext}
                className="absolute right-0 top-0 z-30 h-full w-1/4 flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity"
                aria-label="Next item"
              >
                <ChevronRight className="h-10 w-10 text-white/60" />
              </button>

              {/* Story Card with Reddit details */}
              {currentItem && (
                <div className="absolute inset-0 top-20 bottom-32 px-6 flex items-start justify-center overflow-y-auto review-scrollbar">
                  <div className="w-full max-w-[1600px]">
                    <StoryCard
                      item={currentItem}
                      redditDetails={redditDetails}
                      isLoadingDetails={isLoadingDetails}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom section: Actions - grows upward from bottom */}
            <div className="absolute bottom-0 inset-x-0 z-40 px-6 flex justify-center review-scrollbar overflow-hidden">
              <div className="w-full max-w-[1600px] rounded-b-2xl bg-gradient-to-b from-zinc-800/95 via-zinc-900/98 to-zinc-900 backdrop-blur-xl border-b border-x border-white/[0.08] pt-5 pb-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                <StoryActions
                  onTomorrow={handleTomorrow}
                  onWeek={handleWeek}
                  onArchive={handleArchive}
                  onReadNow={handleReadNow}
                  isLoading={isActioning}
                />
                <p className="text-center text-white/30 text-[11px] mt-3 tracking-wide">
                  <span className="text-white/40">P</span> Pause · <span className="text-white/40">1</span> Tomorrow · <span className="text-white/40">2</span> Week · <span className="text-white/40">3</span> Archive · <span className="text-white/40">Enter</span> Read · <span className="text-white/40">←→</span> Navigate
                </p>
              </div>
            </div>

            {/* Loading indicator for next page */}
            {isFetchingNextPage && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50">
                <Loader2 className="h-6 w-6 animate-spin text-white/60" />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default StoryReviewView
