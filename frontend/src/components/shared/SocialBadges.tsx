// frontend/src/components/shared/SocialBadges.tsx
import { MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SocialCheckResponse } from '@/types'

// HN and Reddit icons as simple SVG components
function HNIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("w-3 h-3", className)}
      fill="currentColor"
    >
      <path d="M0 0v24h24V0H0zm12.3 12.5v5.2h-1.3v-5.2L8 7.3h1.4l2.2 3.8 2.2-3.8h1.4l-2.9 5.2z"/>
    </svg>
  )
}

function RedditIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("w-3 h-3", className)}
      fill="currentColor"
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  )
}

interface SocialBadgesProps {
  data: SocialCheckResponse | undefined
  isLoading?: boolean
  compact?: boolean
  className?: string
}

/**
 * SocialBadges - Display HN/Reddit engagement badges
 * Shows score and comment count for each platform
 */
export function SocialBadges({
  data,
  isLoading = false,
  compact = false,
  className
}: SocialBadgesProps) {
  if (isLoading) {
    return (
      <div className={cn("flex gap-1.5", className)}>
        <Badge variant="outline" className="animate-pulse bg-muted">
          <span className="w-12 h-3" />
        </Badge>
      </div>
    )
  }

  if (!data) return null

  const hasHN = data.hackernews.length > 0
  const hasReddit = data.reddit.length > 0

  if (!hasHN && !hasReddit) return null

  // Aggregate scores for display
  const hnTotal = data.hackernews.reduce((sum, m) => sum + m.score, 0)
  const hnComments = data.hackernews.reduce((sum, m) => sum + m.comment_count, 0)
  const redditTotal = data.reddit.reduce((sum, m) => sum + m.score, 0)
  const redditComments = data.reddit.reduce((sum, m) => sum + m.comment_count, 0)

  return (
    <div className={cn("flex gap-1.5 flex-wrap", className)}>
      {hasHN && (
        <Badge
          variant="outline"
          className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/20 transition-colors"
        >
          <HNIcon className="mr-1" />
          {compact ? (
            <span>{hnTotal}</span>
          ) : (
            <>
              <span>{hnTotal}</span>
              <span className="mx-1 text-orange-400/60">|</span>
              <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
              <span>{hnComments}</span>
            </>
          )}
        </Badge>
      )}

      {hasReddit && (
        <Badge
          variant="outline"
          className="bg-orange-600/10 text-orange-500 dark:text-orange-300 border-orange-600/30 hover:bg-orange-600/20 transition-colors"
        >
          <RedditIcon className="mr-1" />
          {compact ? (
            <span>{redditTotal}</span>
          ) : (
            <>
              <span>{redditTotal}</span>
              <span className="mx-1 text-orange-500/60">|</span>
              <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
              <span>{redditComments}</span>
            </>
          )}
        </Badge>
      )}
    </div>
  )
}

export default SocialBadges
