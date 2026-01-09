import { useState } from 'react'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FaviconImageProps {
  url: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

const iconSizeClasses = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
}

/**
 * Extract domain from URL for favicon API
 */
function extractDomain(url: string | null): string | null {
  if (!url) return null

  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return null
  }
}

/**
 * Generate a consistent color based on domain string
 */
function getDomainColor(domain: string): { from: string; via: string; to: string } {
  // Simple hash function for consistent colors
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Vibrant gradient palettes
  const gradients = [
    { from: 'from-violet-500', via: 'via-purple-500', to: 'to-fuchsia-500' },
    { from: 'from-cyan-500', via: 'via-blue-500', to: 'to-indigo-500' },
    { from: 'from-emerald-500', via: 'via-teal-500', to: 'to-cyan-500' },
    { from: 'from-orange-500', via: 'via-amber-500', to: 'to-yellow-500' },
    { from: 'from-rose-500', via: 'via-pink-500', to: 'to-fuchsia-500' },
    { from: 'from-blue-500', via: 'via-indigo-500', to: 'to-violet-500' },
    { from: 'from-lime-500', via: 'via-green-500', to: 'to-emerald-500' },
    { from: 'from-red-500', via: 'via-rose-500', to: 'to-pink-500' },
  ]

  return gradients[Math.abs(hash) % gradients.length]
}

/**
 * FaviconImage component - Displays website favicon with graceful fallback
 * Uses Google Favicon API with error handling and beautiful gradient fallback
 */
export function FaviconImage({ url, alt = 'Favicon', size = 'md', className }: FaviconImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const domain = extractDomain(url)

  // If no valid domain or image failed to load, show fallback
  if (!domain || hasError) {
    const colors = getDomainColor(domain || 'default')
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md',
          'bg-gradient-to-br',
          colors.from,
          colors.via,
          colors.to,
          'shadow-sm',
          'ring-1 ring-white/20',
          sizeClasses[size],
          className
        )}
      >
        <Globe
          className={cn(
            'text-white/90 drop-shadow-sm',
            iconSizeClasses[size]
          )}
        />
      </div>
    )
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      {/* Loading placeholder */}
      {!isLoaded && (
        <div
          className={cn(
            'absolute inset-0 rounded-md bg-muted animate-pulse',
            sizeClasses[size]
          )}
        />
      )}
      <img
        src={faviconUrl}
        alt={alt}
        className={cn(
          'rounded-md shadow-sm',
          'transition-all duration-200 ease-out',
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
          sizeClasses[size]
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}

export default FaviconImage
