export type SprintStatus =
  | 'planning'
  | 'active'
  | 'review'
  | 'retrospective'
  | 'completed'

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done'

export interface ScrumProject {
  id: string
  name: string
  description: string
  backlogItems: BacklogItem[]
  sprints: Sprint[]
  team: TeamMember[]
  createdAt: string
  updatedAt: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'product-owner' | 'scrum-master' | 'developer'
}

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string
  startDate: string
  endDate: string
  status: SprintStatus
  backlogItems: BacklogItem[]
  reviewNotes?: string
  retroItems?: RetroItem[]
}

export interface BacklogItem {
  id: string
  projectId: string
  sprintId?: string
  epicTitle: string
  featureTitle: string
  userStoryTitle: string
  userStoryDescription: string
  acceptanceCriteria: string[]
  storyPoints: number
  status: TaskStatus
  assigneeId?: string
}

export interface RetroItem {
  id: string
  sprintId: string
  category: 'went-well' | 'could-improve' | 'action-items'
  content: string
  authorId: string
  createdAt: string
}
