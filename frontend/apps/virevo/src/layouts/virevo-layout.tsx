import { Outlet } from 'react-router-dom'

export function VirevoLayout() {
  return (
    <main className="flex flex-1 flex-col overflow-auto">
      <Outlet />
    </main>
  )
}
