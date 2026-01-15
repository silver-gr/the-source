import { useState, useCallback, useEffect, useRef } from 'react'

interface UseReviewTimerOptions {
  duration: number // in seconds
  onComplete: () => void
  pauseDelay?: number // delay before resuming after interaction (ms), default 2000
}

interface UseReviewTimerReturn {
  /** Current time remaining in seconds */
  timeRemaining: number
  /** Progress from 0 to 1 */
  progress: number
  /** Whether the timer is currently running */
  isRunning: boolean
  /** Whether the timer is paused due to interaction */
  isPaused: boolean
  /** Pause the timer (called on interaction start) */
  pause: () => void
  /** Resume the timer (called after interaction ends + delay) */
  resume: () => void
  /** Reset the timer to initial duration */
  reset: () => void
  /** Force complete (skip to next) */
  skip: () => void
}

/**
 * useReviewTimer hook - Hybrid timer for story review
 *
 * Behavior:
 * - Countdown runs every 100ms when active
 * - Pauses on mousedown/touchstart
 * - Resumes 2s after mouseup/touchend
 * - On complete: calls onComplete callback (auto-advance)
 */
export function useReviewTimer({
  duration,
  onComplete,
  pauseDelay = 2000,
}: UseReviewTimerOptions): UseReviewTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(duration)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCompleteRef = useRef(onComplete)

  // Keep onComplete ref up to date
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current)
      resumeTimeoutRef.current = null
    }
  }, [])

  // Start the countdown interval
  const startInterval = useCallback(() => {
    if (intervalRef.current) return // Already running

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 0.1
        if (newTime <= 0) {
          clearTimers()
          setIsRunning(false)
          // Use setTimeout to avoid state update during render
          setTimeout(() => onCompleteRef.current(), 0)
          return 0
        }
        return newTime
      })
    }, 100)
  }, [clearTimers])

  // Pause the timer (called on interaction start)
  const pause = useCallback(() => {
    clearTimers()
    setIsRunning(false)
    setIsPaused(true)
  }, [clearTimers])

  // Resume the timer (called after interaction ends + delay)
  const resume = useCallback(() => {
    // Clear any existing resume timeout
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current)
    }

    // Set timeout to resume after delay
    resumeTimeoutRef.current = setTimeout(() => {
      setIsPaused(false)
      setIsRunning(true)
      startInterval()
    }, pauseDelay)
  }, [pauseDelay, startInterval])

  // Reset the timer
  const reset = useCallback(() => {
    clearTimers()
    setTimeRemaining(duration)
    setIsRunning(true)
    setIsPaused(false)
    startInterval()
  }, [clearTimers, duration, startInterval])

  // Skip to next (force complete)
  const skip = useCallback(() => {
    clearTimers()
    setTimeRemaining(0)
    setIsRunning(false)
    setIsPaused(false)
    onCompleteRef.current()
  }, [clearTimers])

  // Start timer on mount
  useEffect(() => {
    setIsRunning(true)
    startInterval()

    return () => {
      clearTimers()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when duration changes
  useEffect(() => {
    setTimeRemaining(duration)
  }, [duration])

  const progress = 1 - timeRemaining / duration

  return {
    timeRemaining,
    progress,
    isRunning,
    isPaused,
    pause,
    resume,
    reset,
    skip,
  }
}

export default useReviewTimer
