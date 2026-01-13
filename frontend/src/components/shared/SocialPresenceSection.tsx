// frontend/src/components/shared/SocialPresenceSection.tsx
import { useState } from 'react'
import { ChevronDown, Globe, RefreshCw, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SocialMentionCard } from './SocialMentionCard'
import { useSocialMentions, useCheckSocial, hasSocialMentions } from '@/features/social'

interface SocialPresenceSectionProps {
  itemId: string
  className?: string
}

/**
 * SocialPresenceSection - Expandable section showing HN/Reddit discussions
 * Used in ItemDetailModal
 */
export function SocialPresenceSection({ itemId, className }: SocialPresenceSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  const { data, isLoading: isFetching, error } = useSocialMentions(itemId)
  const checkMutation = useCheckSocial()

  const hasData = hasSocialMentions(data)
  const isChecking = checkMutation.isPending
  const totalMentions = (data?.hackernews.length ?? 0) + (data?.reddit.length ?? 0)

  const handleCheck = () => {
    checkMutation.mutate({ itemId, refresh: true })
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
    // Auto-check if no data when opening
    if (!isOpen && !hasData && !isFetching && !isChecking) {
      checkMutation.mutate({ itemId, refresh: false })
    }
  }

  return (
    <div className={cn("border rounded-lg", className)}>
      {/* Header / Trigger */}
      <button
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between p-3 text-left",
          "hover:bg-muted/50 transition-colors rounded-lg",
          isOpen && "border-b"
        )}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Social Presence</span>
          {hasData && (
            <span className="text-sm text-muted-foreground">
              ({totalMentions} discussion{totalMentions !== 1 ? 's' : ''})
            </span>
          )}
          {isChecking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-3 space-y-3">
          {/* Check button if no data */}
          {!hasData && !isFetching && !isChecking && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Check if this link has been discussed on Hacker News or Reddit
              </p>
              <Button onClick={handleCheck} disabled={isChecking}>
                <Search className="w-4 h-4 mr-2" />
                Check HN & Reddit
              </Button>
            </div>
          )}

          {/* Loading state */}
          {(isFetching || isChecking) && !hasData && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Checking...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-sm text-destructive p-3 bg-destructive/10 rounded">
              Failed to load social mentions
            </div>
          )}

          {/* HN mentions */}
          {data && data.hackernews.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <span>Hacker News</span>
                <span className="text-xs text-muted-foreground">
                  ({data.hackernews.length})
                </span>
              </h4>
              {data.hackernews.map((mention) => (
                <SocialMentionCard key={mention.id} mention={mention} />
              ))}
            </div>
          )}

          {/* Reddit mentions */}
          {data && data.reddit.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-orange-500 dark:text-orange-300 flex items-center gap-2">
                <span>Reddit</span>
                <span className="text-xs text-muted-foreground">
                  ({data.reddit.length})
                </span>
              </h4>
              {data.reddit.map((mention) => (
                <SocialMentionCard key={mention.id} mention={mention} />
              ))}
            </div>
          )}

          {/* No results found */}
          {hasData === false && data && !isFetching && !isChecking && (
            <div className="text-center py-4 text-muted-foreground">
              <p>No discussions found on HN or Reddit</p>
            </div>
          )}

          {/* Refresh button when we have data */}
          {hasData && (
            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCheck}
                disabled={isChecking}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isChecking && "animate-spin")} />
                Refresh
              </Button>
            </div>
          )}

          {/* Errors from check */}
          {data?.hn_error && (
            <p className="text-xs text-amber-600">HN: {data.hn_error}</p>
          )}
          {data?.reddit_error && (
            <p className="text-xs text-amber-600">Reddit: {data.reddit_error}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default SocialPresenceSection
