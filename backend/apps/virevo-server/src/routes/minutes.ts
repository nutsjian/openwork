import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { meetingMinutes } from '@/db/schema'

const app = new Hono()

// ── GET /minutes (by project) ────────────────────────────────────

app.get('/', async (c) => {
  const projectId = c.req.query('projectId')

  if (!projectId) {
    return c.json({ error: 'projectId query param required' }, 400)
  }

  const minutes = await db
    .select()
    .from(meetingMinutes)
    .where(eq(meetingMinutes.projectId, projectId))
    .orderBy(desc(meetingMinutes.createdAt))

  return c.json(minutes)
})

// ── GET /minutes/:id ────────────────────────────────────────────

app.get('/:id', async (c) => {
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

export { app as minuteRoutes }
