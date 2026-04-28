import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { NavDocuments } from '@/components/nav-documents'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { getSubAppByPath } from '@/lib/sub-apps-registry'
import { VirevoNavContent } from 'virevo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@workspace/ui/components/sidebar'
import {
  SquaresFourIcon,
  ListIcon,
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  CameraIcon,
  FileTextIcon,
  GearIcon,
  QuestionIcon,
  MagnifyingGlassIcon,
  DatabaseIcon,
  ChartLineIcon,
  FileIcon,
  CommandIcon,
  ArrowLeftIcon,
} from '@phosphor-icons/react'

const data = {
  user: {
    name: 'Dev AI',
    email: 'dev@openwork.ai',
    avatar: '/avatars/openwork.jpg',
  },
  navMain: [
    {
      title: 'Workspace',
      url: '#',
      icon: <SquaresFourIcon />,
    },
    {
      title: 'Tasks',
      url: '#',
      icon: <ListIcon />,
    },
    {
      title: 'Insights',
      url: '#',
      icon: <ChartBarIcon />,
    },
    {
      title: 'Projects',
      url: '#',
      icon: <FolderIcon />,
    },
    {
      title: 'Contributors',
      url: '#',
      icon: <UsersIcon />,
    },
  ],
  navClouds: [
    {
      title: 'Snippets',
      icon: <CameraIcon />,
      isActive: true,
      url: '#',
      items: [
        {
          title: 'Recent',
          url: '#',
        },
        {
          title: 'Saved',
          url: '#',
        },
      ],
    },
    {
      title: 'Specs',
      icon: <FileTextIcon />,
      url: '#',
      items: [
        {
          title: 'Active Specs',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
    {
      title: 'Prompts',
      icon: <FileTextIcon />,
      url: '#',
      items: [
        {
          title: 'Active Prompts',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'Settings',
      url: '#',
      icon: <GearIcon />,
    },
    {
      title: 'Get Help',
      url: '#',
      icon: <QuestionIcon />,
    },
    {
      title: 'Search',
      url: '#',
      icon: <MagnifyingGlassIcon />,
    },
  ],
  documents: [
    {
      name: 'Data Library',
      url: '#',
      icon: <DatabaseIcon />,
    },
    {
      name: 'Dev Logs',
      url: '#',
      icon: <ChartLineIcon />,
    },
    {
      name: 'Code Assistant',
      url: '#',
      icon: <FileIcon />,
    },
  ],
}

function SidebarHeaderContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeSubApp = getSubAppByPath(location.pathname)

  if (activeSubApp) {
    const AppIcon = activeSubApp.icon
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="data-[slot=sidebar-menu-button]:p-1.5!"
            onClick={() => navigate('/')}
          >
            <AppIcon className="size-5!" />
            <span className="text-base font-semibold">{activeSubApp.name}</span>
            <ArrowLeftIcon className="text-muted-foreground ms-auto size-4" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="data-[slot=sidebar-menu-button]:p-1.5!"
          render={<a href="#" />}
        >
          <CommandIcon className="size-5!" />
          <span className="text-base font-semibold">OpenWork</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function SidebarContentArea() {
  const location = useLocation()
  const activeSubApp = getSubAppByPath(location.pathname)

  if (activeSubApp?.id === 'virevo') {
    return <VirevoNavContent />
  }

  return (
    <SidebarContent>
      <NavMain items={data.navMain} />
      <NavDocuments items={data.documents} />
      <NavSecondary items={data.navSecondary} className="mt-auto" />
    </SidebarContent>
  )
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarHeaderContent />
      </SidebarHeader>
      <SidebarContentArea />
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
