import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { meetingMinutes } from '@/db/schema'

const app = new Hono()

// ── GET /projects/:projectId/minutes (list by project) ──────────

app.get('/:id/minutes', async (c) => {
  const id = c.req.param('id')
  const minutes = await db
    .select()
    .from(meetingMinutes)
    .where(eq(meetingMinutes.projectId, id))
    .orderBy(desc(meetingMinutes.createdAt))

  return c.json(minutes)
})

// ── GET /:id (single minutes detail) ────────────────────────────
// Mounted as /api/v1/minutes/:id

const detailApp = new Hono()

detailApp.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [minutes] = await db
    .select()
    .from(meetingMinutes)
    .where(eq(meetingMinutes.id, id))

  if (!minutes) {
    return c.json({ error: 'Meeting Minutes not found' }, 404)
  }

  return c.json(minutes)
})

export { app as projectMinuteRoutes, detailApp as minuteRoutes }
