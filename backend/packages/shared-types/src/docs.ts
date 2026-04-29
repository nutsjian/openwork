export type DocumentCategory =
  | 'requirements'
  | 'meeting-minutes'
  | 'sprint-artifacts'
  | 'reviews'

export interface ProjectDocument {
  id: string
  projectId: string
  category: DocumentCategory
  title: string
  content: string
  createdAt: string
  updatedAt: string
  sourceType: 'brainstorm' | 'scrum'
  sourceId: string
}

export interface DocumentCollection {
  projectId: string
  projectName: string
  documents: ProjectDocument[]
  totalDocs: number
  lastUpdated: string
}

export interface OpenSpecExport {
  id: string
  projectId: string
  projectName: string
  createdAt: string
  version: number
  files: OpenSpecFile[]
}

export interface OpenSpecFile {
  path: string
  content: string
}

export interface OpenSpecExportConfig {
  projectId: string
  includeMeetingMinutes: boolean
  includeSprintArtifacts: boolean
  includeReviews: boolean
}
