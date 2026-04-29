import { Navigate, type RouteObject } from 'react-router-dom'
import { VirevoLayout } from '@/layouts/virevo-layout'

// Brainstorm pages
import { ProjectListPage as BrainstormProjectListPage } from '@/pages/brainstorm/project-list-page'
import { ProjectDetailPage } from '@/pages/brainstorm/project-detail-page'
import { SessionPage } from '@/pages/brainstorm/session-page'
import { BacklogPage } from '@/pages/brainstorm/backlog-page'

// Scrum pages
import { ScrumProjectListPage } from '@/pages/scrum/project-list-page'
import { BoardPage } from '@/pages/scrum/board-page'
import { PlanningPage } from '@/pages/scrum/planning-page'
import { ReviewPage } from '@/pages/scrum/review-page'
import { RetroPage } from '@/pages/scrum/retro-page'

// Docs pages
import { DocsProjectListPage } from '@/pages/docs/project-list-page'
import { DocDetailPage } from '@/pages/docs/doc-detail-page'
import { ExportPage } from '@/pages/docs/export-page'

export const virevoRoutes: RouteObject[] = [
  {
    path: 'virevo',
    element: <VirevoLayout />,
    children: [
      // Brainstorm
      {
        path: 'brainstorm',
        children: [
          { index: true, element: <Navigate to="projects" replace /> },
          { path: 'projects', element: <BrainstormProjectListPage /> },
          { path: 'projects/:id', element: <ProjectDetailPage /> },
          { path: 'backlog', element: <BacklogPage /> },
        ],
      },
      // Sessions (top-level route)
      { path: 'sessions/:sessionId', element: <SessionPage /> },
      // Scrum
      {
        path: 'scrum',
        children: [
          { index: true, element: <Navigate to="projects" replace /> },
          { path: 'projects', element: <ScrumProjectListPage /> },
          { path: 'projects/:id/board', element: <BoardPage /> },
          { path: 'planning/:id', element: <PlanningPage /> },
          { path: 'review/:id', element: <ReviewPage /> },
          { path: 'retro/:id', element: <RetroPage /> },
        ],
      },
      // Docs
      {
        path: 'docs',
        children: [
          { index: true, element: <Navigate to="projects" replace /> },
          { path: 'projects', element: <DocsProjectListPage /> },
          { path: 'projects/:id', element: <DocDetailPage /> },
          { path: 'export', element: <ExportPage /> },
        ],
      },
      // Default redirect
      { index: true, element: <Navigate to="brainstorm" replace /> },
    ],
  },
]
