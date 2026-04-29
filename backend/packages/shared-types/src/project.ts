export interface Project {
  id: string
  name: string
  description: string
  status: 'brainstorming' | 'reviewing' | 'scrum' | 'completed'
  createdAt: string
  updatedAt: string
  members: ProjectMember[]
}

export interface ProjectMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'member'
  joinedAt: string
}

export interface BrainstormSession {
  id: string
  projectId: string
  title: string
  status: 'active' | 'completed'
  createdAt: string
  endedAt?: string
  participants: SessionParticipant[]
  messages: SessionMessage[]
  turnQueue: string[]
  currentSpeakerIndex: number
}

export interface SessionParticipant {
  id: string
  name: string
  type: 'user' | 'ai'
  status: 'waiting' | 'speaking' | 'skipped' | 'done'
}

export interface SessionMessage {
  id: string
  sessionId: string
  participantId: string
  content: string
  timestamp: string
  type: 'user' | 'ai'
}

export interface Epic {
  id: string
  projectId: string
  title: string
  description: string
  features: Feature[]
  averageScore: number
  reviewCount: number
  backlogStatus: 'pending' | 'admitted' | 'rejected'
}

export interface Feature {
  id: string
  epicId: string
  title: string
  description: string
  userStories: UserStory[]
}

export interface UserStory {
  id: string
  featureId: string
  title: string
  description: string
  acceptanceCriteria: string[]
}

export interface MeetingMinutes {
  id: string
  sessionId: string
  projectId: string
  sessionDate: string
  participants: string[]
  summary: string
  proposedRequirements: ProposedRequirement[]
  openQuestions: string[]
  actionItems: ActionItem[]
}

export interface ProposedRequirement {
  type: 'epic' | 'feature' | 'user-story'
  title: string
  description: string
}

export interface ActionItem {
  id: string
  assignee: string
  description: string
  status: 'pending' | 'completed'
}

export interface Review {
  id: string
  requirementId: string
  projectId: string
  reviewerId: string
  score: number
  comment: string
  createdAt: string
}
