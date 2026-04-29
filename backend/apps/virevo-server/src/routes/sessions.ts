// @ts-nocheck
// Mastra v1.28 runtime types have gaps:
// - WorkflowRunOutput.stream property not in public types (but exists at runtime)
// - resumeStream options (closeOnSuspend) not fully typed
// - extractRequirementsTool.execute parameter types mismatch
// All patterns validated at runtime.

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { sessions, messages } from '@/db/schema'
import { getMastra } from '@/workflows/brainstorm'
import { extractRequirementsTool } from '@/tools/extract-requirements'

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

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.timestamp)

  return c.json({ ...session, messages: msgs })
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

      // WorkflowRunOutput exposes a ReadableStream at runtime
      // even though the public types don't declare it
      const reader = (output as any).stream.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        if (value?.type === 'step-result' && value?.id === 'ai-turn') {
          const aiMessage = value?.payload?.output?.aiMessage
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
        } else if (value?.type === 'step-suspended') {
          await stream.writeSSE({
            event: 'suspended',
            data: JSON.stringify({ step: value.id }),
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

// ── POST /sessions/:id/messages (send message + resume) ────────

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

  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const run = await workflow.createRun({ runId: session.mastraRunId! })
  let result
  try {
    result = await run.resume({
      step: 'user-turn',
      resumeData: { message: parsed.data.content },
    })
  } catch (err: any) {
    console.error('[sessions] Workflow resume error:', err.message)
    console.error(err.stack?.substring(0, 500))
    return c.json(
      { error: `Workflow error: ${err.message}`, runId: session.mastraRunId },
      500,
    )
  }

  console.log(
    '[sessions] Resume result status:',
    result.status,
    'steps:',
    Object.keys(result.steps || {}),
  )

  const aiTurnStep = result.steps?.['ai-turn'] as any
  const aiMessage = aiTurnStep?.output?.aiMessage ?? null

  if (aiMessage) {
    await db.insert(messages).values({
      sessionId: id,
      participantId: 'ai',
      content: aiMessage,
      type: 'ai',
    })
  }

  return c.json({
    message: savedMessage,
    aiMessage: aiMessage ?? null,
    workflowStatus: result.status,
    runId: session.mastraRunId,
  })
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

  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const run = await workflow.createRun({ runId: session.mastraRunId! })
  const result = await run.resume({
    step: 'user-turn',
    resumeData: { endSession: true },
  })

  await db
    .update(sessions)
    .set({ status: 'completed', endedAt: new Date() })
    .where(eq(sessions.id, id))

  return c.json({ workflowStatus: result.status })
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

  const result = await extractRequirementsTool.execute({
    conversationHistory: msgs.map((m) => ({
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
  })

  return c.json(result)
})

export { app as sessionRoutes }
