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
  'completing',
  'completed',
])

export const messageTypeEnum = pgEnum('message_type', ['user', 'ai', 'system'])

export const chatMessageStatusEnum = pgEnum('chat_message_status', [
  'sending',
  'sent',
  'failed',
])

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

export const sessionParticipantRoleEnum = pgEnum('session_participant_role', [
  'host',
  'member',
])

export const handRaiseStatusEnum = pgEnum('hand_raise_status', [
  'pending',
  'allowed',
  'dismissed',
])

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
  email: text('email'),
  role: memberRoleEnum('role').notNull().default('member'),
  inviteToken: text('invite_token').unique(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
})

// Sessions (chat groups)
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: sessionStatusEnum('status').notNull().default('active'),
  roundNumber: integer('round_number').notNull().default(0),
  creatorId: uuid('creator_id').references(() => projectMembers.id, {
    onDelete: 'set null',
  }),
  lastMessageAt: timestamp('last_message_at').defaultNow(),
  lastMessagePreview: text('last_message_preview').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
})

// Messages (chat messages)
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull(),
  nickname: text('nickname').notNull().default(''),
  content: text('content').notNull(),
  type: messageTypeEnum('type').notNull(),
  messageType: text('message_type').notNull().default('text'), // text, system, ai
  status: chatMessageStatusEnum('status').notNull().default('sent'),
  replyTo: uuid('reply_to'),
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

// Session Participants (chat group members)
export const sessionParticipants = pgTable('session_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  projectMemberId: uuid('project_member_id').references(
    () => projectMembers.id,
    { onDelete: 'set null' },
  ),
  nickname: text('nickname').notNull(),
  role: sessionParticipantRoleEnum('role').notNull().default('member'),
  status: text('status').notNull().default('active'), // 'active' | 'left'
  color: text('color').notNull().default('#4F46E5'),
  lastReadAt: timestamp('last_read_at').defaultNow(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
})

// Hand Raises
export const handRaises = pgTable('hand_raises', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id')
    .notNull()
    .references(() => sessionParticipants.id, { onDelete: 'cascade' }),
  status: handRaiseStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Reviews (member scores for epics)
export const reviews = pgTable('reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  epicId: uuid('epic_id')
    .notNull()
    .references(() => epics.id, { onDelete: 'cascade' }),
  projectMemberId: uuid('project_member_id')
    .notNull()
    .references(() => projectMembers.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  comment: text('comment').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
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
