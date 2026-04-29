import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core'

// Enums
export const projectStatusEnum = pgEnum('project_status', [
  'brainstorming',
  'reviewing',
  'scrum',
  'completed',
])

export const sessionStatusEnum = pgEnum('session_status', [
  'active',
  'completed',
])

export const messageTypeEnum = pgEnum('message_type', ['user', 'ai'])

export const participantTypeEnum = pgEnum('participant_type', [
  'user',
  'ai',
])

export const participantStatusEnum = pgEnum('participant_status', [
  'waiting',
  'speaking',
  'skipped',
  'done',
])

export const requirementTypeEnum = pgEnum('requirement_type', [
  'epic',
  'feature',
  'user-story',
])

export const backlogStatusEnum = pgEnum('backlog_status', [
  'pending',
  'admitted',
  'rejected',
])

export const actionItemStatusEnum = pgEnum('action_item_status', [
  'pending',
  'completed',
])

export const memberRoleEnum = pgEnum('member_role', ['owner', 'member'])

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: projectStatusEnum('status').notNull().default('brainstorming'),
  requirementExtractionMode: text('requirement_extraction_mode')
    .notNull()
    .default('manual'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Project Members
export const projectMembers = pgTable('project_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: memberRoleEnum('role').notNull().default('member'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
})

// Sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: sessionStatusEnum('status').notNull().default('active'),
  mastraRunId: text('mastra_run_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
})

// Messages
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull(),
  content: text('content').notNull(),
  type: messageTypeEnum('type').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
})

// Epics
export const epics = pgTable('epics', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => sessions.id),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  averageScore: integer('average_score').notNull().default(0),
  reviewCount: integer('review_count').notNull().default(0),
  backlogStatus: backlogStatusEnum('backlog_status')
    .notNull()
    .default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Features
export const features = pgTable('features', {
  id: uuid('id').defaultRandom().primaryKey(),
  epicId: uuid('epic_id')
    .notNull()
    .references(() => epics.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
})

// User Stories
export const userStories = pgTable('user_stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  featureId: uuid('feature_id')
    .notNull()
    .references(() => features.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  acceptanceCriteria: jsonb('acceptance_criteria').notNull().default([]),
})

// Meeting Minutes
export const meetingMinutes = pgTable('meeting_minutes', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  sessionDate: timestamp('session_date').notNull(),
  participants: jsonb('participants').notNull().default([]),
  summary: text('summary').notNull().default(''),
  proposedRequirements: jsonb('proposed_requirements').notNull().default([]),
  openQuestions: jsonb('open_questions').notNull().default([]),
  actionItems: jsonb('action_items').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
