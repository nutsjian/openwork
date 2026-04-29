// @ts-nocheck
// Mastra v1.28 runtime types (Run, Workflow.resume) don't fully expose
// in the public type definitions. Validated at runtime.

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { sessions, messages } from '@/db/schema'
import { getMastra } from '@/workflows/brainstorm'
import { extractRequirementsTool } from '@/tools/extract-requirements'

const app = new Hono()

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

  // Start the Mastra workflow — it will suspend at userTurn immediately
  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const run = await workflow.createRun()
  await run.start({
    inputData: {
      projectId: parsed.data.projectId,
      sessionTitle: parsed.data.title,
    },
  })

  // Persist the workflow run ID
  await db
    .update(sessions)
    .set({ mastraRunId: run.runId })
    .where(eq(sessions.id, session.id))

  return c.json(
    { ...session, mastraRunId: run.runId, status: run.status },
    201,
  )
})

// ── GET /sessions/:id ────────────────────────────────────────────

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id))

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

  // Resume the workflow at userTurn with the message
  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const result = await workflow.resume({
    runId: session.mastraRunId!,
    step: 'user-turn',
    resumeData: { message: parsed.data.content },
  })

  return c.json({
    message: savedMessage,
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
  const result = await workflow.resume({
    runId: session.mastraRunId!,
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

  // Resume with endSession flag
  const m = getMastra()
  const workflow = m.getWorkflow('brainstorm-session')
  const result = await workflow.resume({
    runId: session.mastraRunId!,
    step: 'user-turn',
    resumeData: { endSession: true },
  })

  // Mark session as completed
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

  // @ts-expect-error Mastra Tool.execute type mismatch — works at runtime
  const result: any = await extractRequirementsTool.execute(
    {
      conversationHistory: msgs.map((m: any) => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    },
    undefined,
  )

  return c.json(result)
})

export { app as sessionRoutes }
