import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq, desc } from 'drizzle-orm'
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
})

const messageSchema = z.object({
  content: z.string().min(1),
})

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
    })
    .returning()

  return c.json(session, 201)
})

app.get('/', async (c) => {
  const projectId = c.req.query('projectId')

  if (projectId) {
    const result = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        status: sessions.status,
        createdAt: sessions.createdAt,
        endedAt: sessions.endedAt,
      })
      .from(sessions)
      .where(eq(sessions.projectId, projectId))
      .orderBy(desc(sessions.createdAt))
    return c.json(result)
  }

  const result = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      status: sessions.status,
      createdAt: sessions.createdAt,
      endedAt: sessions.endedAt,
    })
    .from(sessions)
    .orderBy(desc(sessions.createdAt))
  return c.json(result)
})

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

  return c.json({ ...session, project: project ?? null, messages: msgs })
})

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

app.post('/:id/end', async (c) => {
  const id = c.req.param('id')

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

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

  const [minutes] = await db
    .insert(meetingMinutes)
    .values({
      sessionId: id,
      projectId: session.projectId,
      sessionDate: session.createdAt,
      summary: minutesText,
    })
    .returning()

  await db
    .update(sessions)
    .set({ status: 'completed', endedAt: new Date() })
    .where(eq(sessions.id, id))

  return c.json({ minutes })
})

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

export { app as sessionRoutes }
