import { Outlet } from 'react-router-dom'

export function VirevoLayout() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Outlet />
    </div>
  )
}
