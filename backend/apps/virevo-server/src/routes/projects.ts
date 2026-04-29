import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { projects, projectMembers } from '@/db/schema'

const app = new Hono()

// ── Validators ────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  requirementExtractionMode: z
    .enum(['manual', 'auto'])
    .optional(),
})

// ── GET /projects ────────────────────────────────────────────────

app.get('/', async (c) => {
  const allProjects = await db.select().from(projects)
  return c.json(allProjects)
})

// ── GET /projects/:id ────────────────────────────────────────────

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [project] = await db.select().from(projects).where(eq(projects.id, id))

  if (!project) {
    return c.json({ error: 'Project not found' }, 404)
  }

  const members = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, id))

  return c.json({ ...project, members })
})

// ── POST /projects ───────────────────────────────────────────────

app.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = createProjectSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const [project] = await db
    .insert(projects)
    .values({
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .returning()

  return c.json(project, 201)
})

// ── PATCH /projects/:id ──────────────────────────────────────────

app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = updateProjectSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const [updated] = await db
    .update(projects)
    .set(parsed.data)
    .where(eq(projects.id, id))
    .returning()

  if (!updated) {
    return c.json({ error: 'Project not found' }, 404)
  }

  return c.json(updated)
})

export { app as projectRoutes }
