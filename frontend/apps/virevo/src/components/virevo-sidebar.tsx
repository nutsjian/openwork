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
  CaretDownIcon,
  CaretRightIcon,
} from '@phosphor-icons/react'
import { cn } from '@workspace/ui/lib/utils'

interface NavItem {
  title: string
  path: string
  icon: React.ReactNode
}

interface NavGroup {
  title: string
  icon: React.ReactNode
  items: NavItem[]
}

export const virevoNavGroups: NavGroup[] = [
  {
    title: '需求讨论',
    icon: <ChatCircleDotsIcon className="size-4" />,
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
    icon: <KanbanIcon className="size-4" />,
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
    icon: <FileTextIcon className="size-4" />,
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

export function VirevoNavContent() {
  const location = useLocation()

  return (
    <nav className="flex flex-col gap-1 overflow-y-auto p-2">
      {virevoNavGroups.map((group) => {
        const hasActive = group.items.some((item) =>
          location.pathname.startsWith(item.path.split('/:')[0]),
        )

        return <NavGroupItem key={group.title} group={group} hasActive={hasActive} />
      })}
    </nav>
  )
}

function NavGroupItem({
  group,
  hasActive: hasActiveProp,
}: {
  group: NavGroup
  hasActive?: boolean
}) {
  const location = useLocation()
  const [isOpen, setIsOpen] = React.useState(() =>
    group.items.some((item) =>
      location.pathname.startsWith(item.path.split('/:')[0]),
    ),
  )

  const hasActive = hasActiveProp ?? group.items.some((item) =>
    location.pathname.startsWith(item.path.split('/:')[0]),
  )

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent',
          hasActive && 'text-accent-foreground',
          !hasActive && 'text-muted-foreground',
        )}
      >
        {isOpen ? (
          <CaretDownIcon className="size-3 shrink-0" />
        ) : (
          <CaretRightIcon className="size-3 shrink-0" />
        )}
        {group.icon}
        <span>{group.title}</span>
      </button>
      {isOpen && (
        <div className="ml-4 flex flex-col gap-0.5 border-l pl-2">
          {group.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={false}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground',
                )
              }
            >
              {item.icon}
              <span>{item.title}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
