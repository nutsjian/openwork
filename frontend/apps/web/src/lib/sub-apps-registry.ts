import type { ComponentType } from 'react'
import { UsersIcon } from '@phosphor-icons/react'

export interface SubAppConfig {
  id: string
  name: string
  path: string
  icon: ComponentType<{ className?: string }>
  description: string
}

export const subApps: SubAppConfig[] = [
  {
    id: 'virevo',
    name: 'ViRevo',
    path: '/virevo',
    icon: UsersIcon,
    description: 'AI 辅助的敏捷需求管理与 Scrum 执行',
  },
]

export function getSubAppByPath(
  pathname: string,
): SubAppConfig | undefined {
  return subApps.find((app) => pathname.startsWith(app.path))
}
