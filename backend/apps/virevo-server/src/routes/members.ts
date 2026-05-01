import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { projectMembers, projects } from '@/db/schema'
import { randomUUID } from 'node:crypto'

const app = new Hono()

// ── GET /projects/:id/members ──────────────────────────────────────

app.get('/:id/members', async (c) => {
  const projectId = c.req.param('id')
  const members = await db
    .select({
      id: projectMembers.id,
      name: projectMembers.name,
      email: projectMembers.email,
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
      inviteToken: projectMembers.inviteToken,
    })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId))

  return c.json(members)
})

// ── POST /projects/:id/members ─────────────────────────────────────

const addMemberSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email().optional(),
})

app.post('/:id/members', async (c) => {
  const projectId = c.req.param('id')
  const body = await c.req.json()
  const parsed = addMemberSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const [member] = await db
    .insert(projectMembers)
    .values({
      projectId,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      role: 'member',
    })
    .returning()

  return c.json(member, 201)
})

// ── DELETE /projects/:id/members/:memberId ──────────────────────────

app.delete('/:id/members/:memberId', async (c) => {
  const memberId = c.req.param('memberId')
  const [deleted] = await db
    .delete(projectMembers)
    .where(eq(projectMembers.id, memberId))
    .returning()

  if (!deleted) {
    return c.json({ error: 'Member not found' }, 404)
  }

  return c.json({ success: true })
})

// ── POST /projects/:id/invite ────────────────────────────────────────

app.post('/:id/invite', async (c) => {
  const projectId = c.req.param('id')

  const token = randomUUID()
  await db
    .update(projectMembers)
    .set({ inviteToken: token })
    .where(
      and(eq(projectMembers.projectId, projectId), isNull(projectMembers.inviteToken)),
    )

  // Return the first member that got the token (for reference)
  const [member] = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.inviteToken, token))

  return c.json({ token, member })
})

// ── GET /join/:token ──────────────────────────────────────────────

app.get('/join/:token', async (c) => {
  const token = c.req.param('token')

  const [member] = await db
    .select({
      id: projectMembers.id,
      name: projectMembers.name,
      projectId: projectMembers.projectId,
    })
    .from(projectMembers)
    .where(eq(projectMembers.inviteToken, token))

  if (!member) {
    return c.json({ error: 'Invalid or expired invite link' }, 404)
  }

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
    })
    .from(projects)
    .where(eq(projects.id, member.projectId))

  return c.json({ member, project })
})

export { app as memberRoutes }
