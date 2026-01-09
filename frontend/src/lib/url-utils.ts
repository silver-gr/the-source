/**
 * Extract domain from URL, removing www. prefix
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'unknown'
  }
}

/**
 * Get favicon URL for a domain using Google's favicon service
 */
export function getFaviconUrl(domain: string, size: number = 32): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}
