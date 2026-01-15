import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play } from 'lucide-react'

import { ReviewConfigPanel } from './ReviewConfigPanel'
import { StoryReviewView } from './StoryReviewView'
import type { ReviewConfig } from '@/types'

const DEFAULT_CONFIG: ReviewConfig = {
  subreddits: [],
  sortBy: 'score',
  timerDuration: 8,
  includeNsfw: false,
  includeBroken: false,
  sources: ['reddit'],
}

interface ReviewFABProps {
  className?: string
}

/**
 * ReviewFAB component - Floating Action Button for Reddit review
 *
 * Position: Fixed bottom-center, offset for sidebar
 * Color: Reddit orange (#FF4500)
 * Behavior: Opens config panel, then starts story review
 */
export function ReviewFAB({ className }: ReviewFABProps) {
  const [showConfig, setShowConfig] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [config, setConfig] = useState<ReviewConfig>(DEFAULT_CONFIG)
  // Key to force remount StoryReviewView and reset internal state
  const [reviewKey, setReviewKey] = useState(0)

  const handleFABClick = useCallback(() => {
    setShowConfig(true)
  }, [])

  const handleStartReview = useCallback(() => {
    setShowConfig(false)
    // Increment key to force fresh state on each new review session
    setReviewKey((k) => k + 1)
    setShowReview(true)
  }, [])

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={handleFABClick}
        className={cn(
          // Positioning: fixed bottom-center, offset for sidebar (pl-64)
          'fixed bottom-6 left-1/2 ml-32 -translate-x-1/2 z-40',
          // Size and shape
          'h-14 w-14 rounded-full p-0',
          // Reddit orange color
          'bg-source-reddit hover:bg-source-reddit/90',
          // Shadow and effects
          'shadow-lg hover:shadow-xl',
          // Animation
          'transition-all duration-200 hover:scale-110',
          // Text color
          'text-white',
          className
        )}
        aria-label="Start Reddit Review"
      >
        <Play className="h-6 w-6" />
      </Button>

      {/* Configuration Panel */}
      <ReviewConfigPanel
        open={showConfig}
        onOpenChange={setShowConfig}
        config={config}
        onConfigChange={setConfig}
        onStart={handleStartReview}
      />

      {/* Story Review View - key forces remount to reset state */}
      <StoryReviewView
        key={reviewKey}
        open={showReview}
        onOpenChange={setShowReview}
        config={config}
      />
    </>
  )
}

export default ReviewFAB
