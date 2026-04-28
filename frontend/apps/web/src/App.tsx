import { BrowserRouter, Navigate, useRoutes } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { HomePage } from '@/components/home-page'
import { SiteHeader } from '@/components/site-header'
import { SubAppSearchDialog } from '@/components/sub-app-search-dialog'
import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { virevoRoutes } from 'virevo'

function AppRoutes() {
  return useRoutes([
    { path: '/', element: <HomePage /> },
    ...virevoRoutes,
    { path: '*', element: <Navigate to="/" replace /> },
  ])
}

export function App() {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <AppRoutes />
          <SubAppSearchDialog />
        </SidebarInset>
      </SidebarProvider>
    </BrowserRouter>
  )
}
