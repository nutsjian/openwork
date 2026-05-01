import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq, desc, and, sql, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  sessions,
  messages,
  meetingMinutes,
  epics,
  features,
  userStories,
  projects,
  sessionParticipants,
} from '@/db/schema'
import { facilitatorAgent } from '@/agents/facilitator'

const app = new Hono()

app.onError((err, c) => {
  console.error('[sessions] Error:', err)
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

const createSessionSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().default('需求讨论会'),
  creatorMemberId: z.string().uuid().optional(),
})

const messageSchema = z.object({
  content: z.string().min(1),
})

// ── POST / — Create session (auto-join creator) ────────────────────

app.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = createSessionSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const [session] = await db
    .insert(sessions)
    .values({
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      creatorId: parsed.data.creatorMemberId || null,
    })
    .returning()

  // Auto-create participant for creator if provided
  let participantId: string | null = null
  if (parsed.data.creatorMemberId) {
    const [participant] = await db
      .insert(sessionParticipants)
      .values({
        sessionId: session.id,
        projectMemberId: parsed.data.creatorMemberId,
        nickname: '创建者',
        role: 'host',
        color: getColor('创建者'),
      })
      .returning()
    participantId = participant.id

    // System message: session created
    await db.insert(messages).values({
      sessionId: session.id,
      participantId: participant.id,
      nickname: '系统',
      content: `讨论会「${session.title}」已创建`,
      type: 'user',
      messageType: 'system',
    })
  }

  return c.json({ ...session, participantId }, 201)
})

// ── GET / — List sessions (with last message preview) ──────────────

app.get('/', async (c) => {
  const projectId = c.req.query('projectId')

  const result = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      status: sessions.status,
      createdAt: sessions.createdAt,
      endedAt: sessions.endedAt,
      lastMessageAt: sessions.lastMessageAt,
      lastMessagePreview: sessions.lastMessagePreview,
    })
    .from(sessions)
    .where(projectId ? eq(sessions.projectId, projectId) : undefined)
    .orderBy(desc(sessions.lastMessageAt))

  return c.json(result)
})

// ── GET /:id — Get session detail ──────────────────────────────────

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, session.projectId))

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.timestamp)

  const participants = await db
    .select({
      id: sessionParticipants.id,
      projectMemberId: sessionParticipants.projectMemberId,
      nickname: sessionParticipants.nickname,
      role: sessionParticipants.role,
      status: sessionParticipants.status,
      color: sessionParticipants.color,
      lastReadAt: sessionParticipants.lastReadAt,
    })
    .from(sessionParticipants)
    .where(eq(sessionParticipants.sessionId, id))

  return c.json({
    ...session,
    project: project ?? null,
    messages: msgs,
    participants,
  })
})

// ── POST /:id/join — Join a session as a member ───────────────────

const joinSchema = z.object({
  projectMemberId: z.string().uuid(),
  nickname: z.string().min(1).max(50),
})

app.post('/:id/join', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = joinSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  // Check if already a member
  const existing = await db
    .select()
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, id),
        eq(sessionParticipants.projectMemberId, parsed.data.projectMemberId),
      ),
    )

  if (existing.length > 0) {
    return c.json({ participantId: existing[0].id })
  }

  const [participant] = await db
    .insert(sessionParticipants)
    .values({
      sessionId: id,
      projectMemberId: parsed.data.projectMemberId,
      nickname: parsed.data.nickname,
      role: 'member',
      color: getColor(parsed.data.nickname),
    })
    .returning()

  // System message: member joined
  await db.insert(messages).values({
    sessionId: id,
    participantId: participant.id,
    nickname: '系统',
    content: `${parsed.data.nickname} 加入了讨论`,
    type: 'user',
    messageType: 'system',
  })

  return c.json({ participantId: participant.id }, 201)
})

// ── POST /:id/read — Mark messages as read ─────────────────────────

app.post('/:id/read', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { participantId } = body

  if (!participantId) {
    return c.json({ error: 'participantId required' }, 400)
  }

  await db
    .update(sessionParticipants)
    .set({ lastReadAt: new Date() })
    .where(eq(sessionParticipants.id, participantId))

  return c.json({ success: true })
})

// ── POST /:id/messages — Send message via REST (1:1 compatibility) ──

app.post('/:id/messages', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = messageSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const [savedMessage] = await db
    .insert(messages)
    .values({
      sessionId: id,
      participantId: 'user',
      content: parsed.data.content,
      type: 'user',
    })
    .returning()

  // Update session last message
  await db
    .update(sessions)
    .set({
      lastMessageAt: savedMessage.timestamp,
      lastMessagePreview: parsed.data.content.slice(0, 100),
    })
    .where(eq(sessions.id, id))

  const existingMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.timestamp)

  const chatMessages = existingMessages.map((m) => ({
    role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))

  try {
    const stream = await facilitatorAgent.stream(chatMessages)

    return streamSSE(c, async (sseStream) => {
      await sseStream.writeSSE({
        event: 'user-message',
        data: JSON.stringify(savedMessage),
      })

      let fullAiMessage = ''

      try {
        for await (const chunk of stream.textStream) {
          fullAiMessage += chunk
          await sseStream.writeSSE({
            event: 'chunk',
            data: JSON.stringify({ text: chunk }),
          })
        }

        if (fullAiMessage) {
          await db.insert(messages).values({
            sessionId: id,
            participantId: 'ai',
            nickname: 'AI 助手',
            content: fullAiMessage,
            type: 'ai',
          })
        }

        await sseStream.writeSSE({
          event: 'done',
          data: JSON.stringify({ saved: true }),
        })
      } catch (err: any) {
        console.error('[sessions] Stream error:', err.message)
        await sseStream.writeSSE({
          event: 'error',
          data: JSON.stringify({ error: err.message }),
        })
      }
    })
  } catch (err: any) {
    console.error('[sessions] Agent error:', err.message)
    return c.json({ error: `Agent error: ${err.message}` }, 500)
  }
})

// ── POST /:id/end ─────────────────────────────────────────────────

app.post('/:id/end', async (c) => {
  const id = c.req.param('id')

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  if (session.status !== 'active') {
    return c.json({ error: 'Session is not active' }, 400)
  }

  await db
    .update(sessions)
    .set({ status: 'completing' })
    .where(eq(sessions.id, id))

  ;(async () => {
    try {
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, id))
        .orderBy(messages.timestamp)

      const historyText = msgs
        .map((m) => `[${m.type === 'user' ? '用户' : 'AI'}]: ${m.content}`)
        .join('\n')

      const minutesText = await facilitatorAgent.generate(
        `请根据以下对话记录生成一份会议纪要（Markdown 格式）。要求包含：
- 会议日期
- 参与者
- 讨论摘要
- 提出的需求（Epic/Feature/User Story）
- 待解决问题
- 行动项

对话记录：
${historyText}`,
      )

      await db.insert(meetingMinutes).values({
        sessionId: id,
        projectId: session.projectId,
        sessionDate: session.createdAt,
        summary: minutesText,
      })
    } catch (err) {
      console.error('[sessions] Background minutes generation failed:', err)
    } finally {
      await db
        .update(sessions)
        .set({ status: 'completed', endedAt: new Date() })
        .where(eq(sessions.id, id))
    }
  })()

  return c.json({ status: 'completing' })
})

// ── POST /:id/extract ──────────────────────────────────────────────

app.post('/:id/extract', async (c) => {
  const id = c.req.param('id')

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.timestamp)

  if (msgs.length === 0) {
    return c.json({ epics: [] })
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  const conversationText = msgs
    .map((m) => `[${m.type === 'user' ? 'user' : 'assistant'}]: ${m.content}`)
    .join('\n')

  const text = await facilitatorAgent.generate(
    `请分析以下对话记录，提取其中涉及的所有需求，并按照 Epic → Feature → User Story 的层级结构进行整理。

要求：
1. 每个需求必须来自对话中明确提到的内容
2. 不要臆造对话中没有提到的需求
3. User Story 需要包含验收标准
4. 以 JSON 格式返回，结构为：
{
  "epics": [
    {
      "title": "...",
      "description": "...",
      "features": [
        {
          "title": "...",
          "description": "...",
          "userStories": [
            {
              "title": "...",
              "description": "...",
              "acceptanceCriteria": ["..."]
            }
          ]
        }
      ]
    }
  ]
}

如果对话中没有足够的信息来提取任何需求，返回 { "epics": [] }。

对话记录：
${conversationText}`,
  )

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  let extractedEpics: any[] = []
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      extractedEpics = parsed.epics ?? []
    } catch {
      extractedEpics = []
    }
  }

  await db.delete(epics).where(eq(epics.sessionId, id))

  for (const epic of extractedEpics) {
    const [insertedEpic] = await db
      .insert(epics)
      .values({
        projectId: session?.projectId,
        sessionId: id,
        title: epic.title,
        description: epic.description ?? '',
      })
      .returning()

    for (const feature of epic.features ?? []) {
      const [insertedFeature] = await db
        .insert(features)
        .values({
          epicId: insertedEpic.id,
          title: feature.title,
          description: feature.description ?? '',
        })
        .returning()

      for (const story of feature.userStories ?? []) {
        await db.insert(userStories).values({
          featureId: insertedFeature.id,
          title: story.title,
          description: story.description ?? '',
          acceptanceCriteria: story.acceptanceCriteria ?? [],
        })
      }
    }
  }

  const persistedEpics = await db
    .select()
    .from(epics)
    .where(eq(epics.sessionId, id))

  const result = []
  for (const epic of persistedEpics) {
    const epicFeatures = await db
      .select()
      .from(features)
      .where(eq(features.epicId, epic.id))

    const featureList = []
    for (const feature of epicFeatures) {
      const featureStories = await db
        .select()
        .from(userStories)
        .where(eq(userStories.featureId, feature.id))

      featureList.push({
        ...feature,
        userStories: featureStories,
      })
    }

    result.push({ ...epic, features: featureList })
  }

  return c.json({ epics: result })
})

// ── Utility ──────────────────────────────────────────────────────

const COLORS = [
  '#4F46E5',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#2563EB',
  '#65A30D',
  '#EA580C',
]

function getColor(nickname: string): string {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export { app as sessionRoutes }
