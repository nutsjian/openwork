import * as React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ChatCircleDotsIcon,
  KanbanIcon,
  FileTextIcon,
  FolderIcon,
  ClipboardTextIcon,
  ClockCounterClockwiseIcon,
  ArrowRightIcon,
  ListChecksIcon,
} from '@phosphor-icons/react'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@workspace/ui/components/sidebar'

interface NavItem {
  title: string
  path: string
  icon: React.ReactNode
}

interface NavGroup {
  title: string
  items: NavItem[]
}

export const virevoNavGroups: NavGroup[] = [
  {
    title: '需求讨论',
    items: [
      {
        title: '项目列表',
        path: '/virevo/brainstorm/projects',
        icon: <FolderIcon className="size-4" />,
      },
      {
        title: 'Backlog',
        path: '/virevo/brainstorm/backlog',
        icon: <ClipboardTextIcon className="size-4" />,
      },
    ],
  },
  {
    title: 'Scrum 管理',
    items: [
      {
        title: '项目看板',
        path: '/virevo/scrum/projects',
        icon: <KanbanIcon className="size-4" />,
      },
      {
        title: 'Sprint 计划',
        path: '/virevo/scrum/planning/:id',
        icon: <ListChecksIcon className="size-4" />,
      },
      {
        title: 'Sprint 评审',
        path: '/virevo/scrum/review/:id',
        icon: <ArrowRightIcon className="size-4" />,
      },
      {
        title: '回顾会议',
        path: '/virevo/scrum/retro/:id',
        icon: <ClockCounterClockwiseIcon className="size-4" />,
      },
    ],
  },
  {
    title: 'OpenSpec 文档',
    items: [
      {
        title: '项目文档',
        path: '/virevo/docs/projects',
        icon: <FileTextIcon className="size-4" />,
      },
      {
        title: '导出 OpenSpec',
        path: '/virevo/docs/export',
        icon: <ArrowRightIcon className="size-4" />,
      },
    ],
  },
]

function isActivePath(pathname: string, itemPath: string): boolean {
  return pathname.startsWith(itemPath.split('/:')[0])
}

export function VirevoNavContent() {
  const location = useLocation()
  const pathname = location?.pathname ?? ''

  return (
    <SidebarContent>
      {virevoNavGroups.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    render={<NavLink to={item.path} />}
                    isActive={isActivePath(pathname, item.path)}
                    tooltip={item.title}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  )
}
