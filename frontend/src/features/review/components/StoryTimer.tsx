import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

interface StoryTimerProps {
  /** Time remaining in seconds */
  timeRemaining: number
  /** Whether timer is running */
  isRunning: boolean
  /** Whether timer is paused due to interaction */
  isPaused: boolean
  className?: string
}

/**
 * StoryTimer component - Visual countdown indicator
 *
 * Features:
 * - Shows remaining seconds
 * - Pause/Play icon based on state
 * - Subtle animation when running
 */
export function StoryTimer({
  timeRemaining,
  isRunning: _isRunning,
  isPaused,
  className,
}: StoryTimerProps) {
  const seconds = Math.ceil(timeRemaining)

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'bg-white/[0.06] ring-1 ring-white/10',
        isPaused && 'ring-source-reddit/30',
        className
      )}
    >
      <Clock className={cn(
        'h-3.5 w-3.5',
        isPaused ? 'text-source-reddit' : 'text-white/50'
      )} />
      <span className={cn(
        'tabular-nums text-sm font-semibold',
        isPaused ? 'text-source-reddit' : 'text-white/70'
      )}>
        {seconds}s
      </span>
    </div>
  )
}

export default StoryTimer
