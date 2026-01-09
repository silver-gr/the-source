import { Globe } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { getFaviconUrl } from '@/lib/url-utils'

interface WebsiteGroupSidebarProps {
  domains: Array<{ domain: string; count: number }> // Sorted by count desc
  selectedDomain: string | null
  onDomainSelect: (domain: string | null) => void
  className?: string
}

export function WebsiteGroupSidebar({
  domains,
  selectedDomain,
  onDomainSelect,
  className,
}: WebsiteGroupSidebarProps) {
  const totalCount = domains.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className={cn('w-64 border-r bg-card flex flex-col', className)}>
      {/* Header */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <Globe className="h-5 w-5" />
          Websites
        </div>
      </div>

      {/* All option */}
      <button
        onClick={() => onDomainSelect(null)}
        className={cn(
          'w-full px-4 py-2 flex justify-between items-center shrink-0',
          'hover:bg-accent transition-colors duration-150',
          selectedDomain === null && 'bg-accent'
        )}
      >
        <span>All</span>
        <span className="text-muted-foreground">{totalCount.toLocaleString()}</span>
      </button>

      <Separator className="shrink-0" />

      {/* Domain list - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="py-2">
          {domains.map(({ domain, count }) => (
            <button
              key={domain}
              onClick={() => onDomainSelect(selectedDomain === domain ? null : domain)}
              className={cn(
                'w-full px-4 py-2 flex items-center gap-3',
                'hover:bg-accent transition-colors duration-150',
                selectedDomain === domain && 'bg-accent'
              )}
            >
              <img
                src={getFaviconUrl(domain)}
                alt=""
                className="w-4 h-4 shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <span className="flex-1 text-left truncate">{domain}</span>
              <span className="text-muted-foreground text-sm shrink-0">
                {count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WebsiteGroupSidebar
