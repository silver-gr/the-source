import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { queryClient } from '@/lib/query-client'
import { ThemeProvider } from '@/hooks/use-theme'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create the router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="unified-saved-theme">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
