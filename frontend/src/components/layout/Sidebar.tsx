import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Bookmark,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <Link to="/" className="flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">UnifiedSaved</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = matchRoute({ to: item.to, fuzzy: true })
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer with theme toggle */}
        <div className="border-t p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleTheme}
            className="w-full justify-start gap-3"
          >
            <ThemeIcon className="h-5 w-5" />
            <span className="capitalize">{theme} Theme</span>
          </Button>
        </div>
      </div>
    </aside>
  )
}
