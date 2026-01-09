import { createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { AppLayout } from '@/components/layout'

export const Route = createRootRoute({
  component: () => (
    <>
      <AppLayout />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  ),
})
