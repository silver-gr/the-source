import { Outlet } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { ReviewFAB } from '@/features/review'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-64">
        <div className="container mx-auto p-6">
          <Outlet />
        </div>
      </main>
      {/* Reddit Review FAB - Always visible */}
      <ReviewFAB />
    </div>
  )
}
