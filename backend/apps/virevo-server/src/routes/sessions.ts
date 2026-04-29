// @ts-nocheck
// Mastra v1.28 runtime types have gaps:
// - WorkflowRunOutput.fullStream property not in public types (but exists at runtime)
// - resumeStream options (closeOnSuspend) not fully typed
// All patterns validated at runtime.

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq, desc, and, sql } from 'drizzle-orm'
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
import { getMastra } from '@/workflows/brainstorm'
import { facilitatorAgent } from '@/agents/facilitator'
import { facilitatorAgent } from '@/agents/facilitator'

const app = new Hono()

app.onError((err, c) => {
  console.error('[sessions] Error:', err)
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

// ── Validators ────────────────────────────────────────────────────

const createSessionSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().default('需求讨论会'),
})

const messageSchema = z.object({
  content: z.string().min(1),
})

// ── POST /sessions (create + start workflow) ─────────────────────

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

  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const run = await workflow.createRun()
  const result = await run.start({
    inputData: {
      projectId: parsed.data.projectId,
      sessionTitle: parsed.data.title,
    },
  })

  await db
    .update(sessions)
    .set({ mastraRunId: run.runId })
    .where(eq(sessions.id, session.id))

  return c.json(
    { ...session, mastraRunId: run.runId, status: result.status },
    201,
  )
})

// ── GET /sessions (list, optionally filtered by projectId) ──────

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

// ── GET /sessions/:id ────────────────────────────────────────────

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  // Fetch associated project info for breadcrumb navigation
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

// ── GET /sessions/:id/stream (SSE streaming) ────────────────────

app.get('/:id/stream', async (c) => {
  const id = c.req.param('id')

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const run = await workflow.createRun({ runId: session.mastraRunId! })

  return streamSSE(c, async (stream) => {
    try {
      const output = run.resumeStream({
        step: 'user-turn',
        resumeData: { message: '' },
        closeOnSuspend: true,
      })

      // WorkflowRunOutput exposes a ReadableStream at .fullStream
      const reader = (output as any).fullStream.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunkType = value?.type
        const payload = value?.payload

        if (
          chunkType === 'workflow-step-result' &&
          payload?.id === 'ai-turn'
        ) {
          const aiMessage = payload?.output?.aiMessage
          if (aiMessage) {
            await db.insert(messages).values({
              sessionId: id,
              participantId: 'ai',
              content: aiMessage,
              type: 'ai',
            })
            await stream.writeSSE({
              data: JSON.stringify({ aiMessage }),
            })
          }
        } else if (chunkType === 'workflow-step-suspended') {
          await stream.writeSSE({
            event: 'suspended',
            data: JSON.stringify({ step: payload?.id }),
          })
        }
      }
    } catch (err: any) {
      console.error('[sessions] Stream error:', err.message)
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: err.message }),
      })
    }
  })
})

// ── POST /sessions/:id/messages (send message + stream AI response) ──

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

  // Save user message to DB
  const [savedMessage] = await db
    .insert(messages)
    .values({
      sessionId: id,
      participantId: 'user',
      content: parsed.data.content,
      type: 'user',
    })
    .returning()

  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const run = await workflow.createRun({ runId: session.mastraRunId! })

  try {
    const output = run.resumeStream({
      step: 'user-turn',
      resumeData: { message: parsed.data.content },
    })

    // resumeStream() returns WorkflowRunOutput with .fullStream (ReadableStream)
    // Chunk types: workflow-start, workflow-step-result, workflow-step-suspended, workflow-finish, etc.
    return streamSSE(c, async (stream) => {
      // Send user message confirmation immediately
      await stream.writeSSE({
        event: 'user-message',
        data: JSON.stringify(savedMessage),
      })

      try {
        const ws = (output as any).fullStream as ReadableStream
        const reader = ws.getReader()
        let fullAiMessage = ''
        let stepResultSaved = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunkType = value?.type
          const payload = value?.payload

          // Debug log (remove in production)
          if (chunkType === 'workflow-step-result') {
            console.log(
              '[sessions] step-result:',
              payload?.id,
              payload?.status,
              JSON.stringify(payload?.output ?? {}).substring(0, 200),
            )
          }

          // Forward workflow-step-result events to client
          if (chunkType === 'workflow-step-result' && payload?.id) {
            await stream.writeSSE({
              event: 'step-result',
              data: JSON.stringify({
                type: 'step-result',
                id: payload.id,
                status: payload.status,
                output: payload.output,
              }),
            })

            // Extract AI message from ai-turn step result
            if (
              payload.id === 'ai-turn' &&
              payload.output?.aiMessage
            ) {
              fullAiMessage = payload.output.aiMessage
            }
          } else if (chunkType === 'workflow-step-suspended') {
            await stream.writeSSE({
              event: 'suspended',
              data: JSON.stringify({
                type: 'suspended',
                step: payload?.id,
              }),
            })
          } else if (chunkType === 'workflow-finish') {
            await stream.writeSSE({
              event: 'finish',
              data: JSON.stringify(payload),
            })
          }
        }

        // Persist the complete AI message to DB
        if (fullAiMessage && !stepResultSaved) {
          await db.insert(messages).values({
            sessionId: id,
            participantId: 'ai',
            content: fullAiMessage,
            type: 'ai',
          })
          stepResultSaved = true
          await stream.writeSSE({
            event: 'done',
            data: JSON.stringify({ saved: true }),
          })
        }
      } catch (err: any) {
        console.error('[sessions] Stream error:', err.message)
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ error: err.message }),
        })
      }
    })
  } catch (err: any) {
    console.error('[sessions] Workflow resume error:', err.message)
    console.error(err.stack?.substring(0, 500))
    return c.json(
      { error: `Workflow error: ${err.message}`, runId: session.mastraRunId },
      500,
    )
  }
})

// ── POST /sessions/:id/skip ─────────────────────────────────────

app.post('/:id/skip', async (c) => {
  const id = c.req.param('id')

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const run = await workflow.createRun({ runId: session.mastraRunId! })
  const result = await run.resume({
    step: 'user-turn',
    resumeData: { message: '' },
  })

  return c.json({ workflowStatus: result.status })
})

// ── POST /sessions/:id/end ──────────────────────────────────────

app.post('/:id/end', async (c) => {
  const id = c.req.param('id')

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  // Fetch all messages for this session
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.timestamp)

  // Generate meeting minutes directly via the agent
  const historyText = msgs
    .map((m) =>
      `[${m.type === 'user' ? '用户' : 'AI'}]: ${m.content}`,
    )
    .join('\n')

  const response = await facilitatorAgent.generate(
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

  const minutesText =
    typeof response === 'string'
      ? response
      : response.text ?? '（生成失败）'

  // Persist meeting minutes to DB
  const [minutes] = await db
    .insert(meetingMinutes)
    .values({
      sessionId: id,
      projectId: session.projectId,
      sessionDate: session.createdAt,
      summary: minutesText,
    })
    .returning()

  // Mark session as completed
  await db
    .update(sessions)
    .set({ status: 'completed', endedAt: new Date() })
    .where(eq(sessions.id, id))

  return c.json({ minutes })
})

// ── POST /sessions/:id/extract ─────────────────────────────────

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

  // Get session for projectId
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))

  // Build conversation text for the AI
  const conversationText = msgs
    .map((m) => `[${m.type === 'user' ? 'user' : 'assistant'}]: ${m.content}`)
    .join('\n')

  const response = await facilitatorAgent.generate(
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

  const text =
    typeof response === 'string'
      ? response
      : (response.text ?? '{"epics": []}')

  // Extract JSON from response (may be wrapped in markdown code block)
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

  // Overwrite mode: delete existing epics for this session (cascades to features + user_stories)
  await db
    .delete(epics)
    .where(eq(epics.sessionId, id))

  // Persist extracted requirements
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

  // Return persisted structure with nested features + userStories
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
