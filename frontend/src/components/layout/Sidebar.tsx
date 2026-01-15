import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Bookmark,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    to: '/items',
    label: 'Saved Items',
    icon: Bookmark,
  },
  {
    to: '/sync',
    label: 'Sync Status',
    icon: RefreshCw,
  },
]

export function Sidebar() {
  const matchRoute = useMatchRoute()
  const { theme, setTheme, resolvedTheme } = useTheme()

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen w-64',
        'flex flex-col',
        'bg-[--color-sidebar-bg] text-[--color-sidebar-fg]',
        'border-r border-[--color-sidebar-border]',
        'sidebar-scrollbar'
      )}
    >
      {/* Logo Section */}
      <div className="relative px-5 py-6">
        {/* Decorative gradient line */}
        <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-[--color-sidebar-accent]/40 to-transparent" />

        <Link
          to="/"
          className={cn(
            'group flex flex-col items-center gap-3',
            'transition-transform duration-300',
            'hover:scale-[1.02]'
          )}
        >
          {/* Logo image */}
          <div className="relative">
            <img
              src="/logo.png"
              alt="The Source"
              className={cn(
                'w-full max-w-[160px] h-auto',
                'transition-all duration-300',
                'group-hover:brightness-110'
              )}
            />
            {/* Subtle glow on hover */}
            <div
              className={cn(
                'absolute inset-0 opacity-0 blur-xl',
                'bg-[--color-sidebar-accent]/20',
                'transition-opacity duration-300',
                'group-hover:opacity-100',
                '-z-10'
              )}
            />
          </div>

          {/* Brand name with editorial typography */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xl font-semibold tracking-tight',
                'font-[family-name:--font-family-display]',
                'text-[--color-sidebar-fg]'
              )}
            >
              The Source
            </span>
            <Sparkles className="h-4 w-4 text-[--color-sidebar-accent] animate-subtle-pulse" />
          </div>
        </Link>

        {/* Bottom border with gradient */}
        <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-[--color-sidebar-border] to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = matchRoute({ to: item.to, fuzzy: item.to !== '/' })
          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-4 py-2.5',
                'text-sm font-medium',
                'transition-all duration-200 ease-out',
                isActive ? [
                  'bg-[--color-sidebar-active]/15 text-[--color-sidebar-accent]',
                  'shadow-[inset_0_0_0_1px] shadow-[--color-sidebar-active]/20',
                ] : [
                  'text-[--color-sidebar-muted]',
                  'hover:bg-[--color-sidebar-hover] hover:text-[--color-sidebar-fg]',
                ]
              )}
            >
              {/* Active indicator bar */}
              <div
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full',
                  'bg-[--color-sidebar-accent]',
                  'transition-all duration-200',
                  isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'
                )}
              />

              <Icon
                className={cn(
                  'h-5 w-5 flex-shrink-0',
                  'transition-all duration-200',
                  isActive
                    ? 'text-[--color-sidebar-accent]'
                    : 'text-[--color-sidebar-muted] group-hover:text-[--color-sidebar-fg]',
                  'group-hover:scale-110'
                )}
              />

              <span className="transition-colors duration-200">
                {item.label}
              </span>

              {/* Badge (if provided) */}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={cn(
                    'ml-auto px-2 py-0.5 text-xs font-mono font-semibold rounded-full',
                    'bg-[--color-sidebar-accent]/20 text-[--color-sidebar-accent]'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4">
        {/* Divider */}
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-[--color-sidebar-border] to-transparent" />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleTheme}
          className={cn(
            'w-full justify-start gap-3 px-4 py-2.5',
            'text-[--color-sidebar-muted] hover:text-[--color-sidebar-fg]',
            'hover:bg-[--color-sidebar-hover]',
            'transition-all duration-200',
            'rounded-lg'
          )}
        >
          <ThemeIcon
            className={cn(
              'h-5 w-5',
              'transition-transform duration-200',
              'group-hover:rotate-12'
            )}
          />
          <span className="text-sm font-medium capitalize">
            {theme === 'system' ? 'Auto' : theme}
          </span>

          {/* Theme indicator dot */}
          <div
            className={cn(
              'ml-auto h-2 w-2 rounded-full',
              'transition-colors duration-200',
              theme === 'dark'
                ? 'bg-indigo-400'
                : theme === 'light'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
            )}
          />
        </Button>

        {/* Version / branding */}
        <div className="mt-3 px-4 text-center">
          <span className="text-[10px] font-mono text-[--color-sidebar-muted]/60 tracking-wider uppercase">
            v0.2.0 · Editorial
          </span>
        </div>
      </div>
    </aside>
  )
}
