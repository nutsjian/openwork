import { Hono } from 'hono'
import { eq, and, desc, avg, count, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  epics,
  features,
  userStories,
  reviews,
  projectMembers,
} from '@/db/schema'

const app = new Hono()

app.onError((err, c) => {
  console.error('[epics] Error:', err)
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

// ── GET /projects/:projectId/epics ──────────────────────────────

app.get('/projects/:projectId/epics', async (c) => {
  const projectId = c.req.param('projectId')

  const projectEpics = await db
    .select()
    .from(epics)
    .where(eq(epics.projectId, projectId))
    .orderBy(desc(epics.createdAt))

  const result = []
  for (const epic of projectEpics) {
    const epicFeatures = await db
      .select()
      .from(features)
      .where(eq(features.epicId, epic.id))
      .orderBy(features.id)

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

    result.push({
      ...epic,
      averageScore: epic.averageScore / 10, // stored as ×10
      features: featureList,
    })
  }

  return c.json(result)
})

// ── POST /epics/:id/score ────────────────────────────────────────

const scoreSchema = z.object({
  projectMemberId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

app.post('/epics/:id/score', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = scoreSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const [epic] = await db
    .select()
    .from(epics)
    .where(eq(epics.id, id))

  if (!epic) {
    return c.json({ error: 'Epic not found' }, 404)
  }

  // Upsert review
  await db
    .insert(reviews)
    .values({
      epicId: id,
      projectMemberId: parsed.data.projectMemberId,
      score: parsed.data.score,
      comment: parsed.data.comment || '',
    })
    .onConflictDoUpdate({
      target: [reviews.epicId, reviews.projectMemberId],
      set: {
        score: parsed.data.score,
        comment: parsed.data.comment || '',
        createdAt: new Date(),
      },
    })

  // Recalculate average score
  const [agg] = await db
    .select({
      avgScore: avg(reviews.score),
      reviewCount: count(reviews.id),
    })
    .from(reviews)
    .where(eq(reviews.epicId, id))

  const newAvgScore = Math.round(Number(agg.avgScore || 0) * 10)

  await db
    .update(epics)
    .set({
      averageScore: newAvgScore,
      reviewCount: agg.reviewCount || 0,
    })
    .where(eq(epics.id, id))

  return c.json({
    averageScore: newAvgScore / 10,
    reviewCount: agg.reviewCount || 0,
  })
})

// ── GET /epics/:id/reviews ───────────────────────────────────────

app.get('/epics/:id/reviews', async (c) => {
  const id = c.req.param('id')

  const epicReviews = await db
    .select({
      id: reviews.id,
      score: reviews.score,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      memberName: projectMembers.name,
    })
    .from(reviews)
    .leftJoin(projectMembers, eq(reviews.projectMemberId, projectMembers.id))
    .where(eq(reviews.epicId, id))
    .orderBy(desc(reviews.createdAt))

  return c.json(epicReviews)
})

// ── POST /epics/:id/admit ────────────────────────────────────────

app.post('/epics/:id/admit', async (c) => {
  const id = c.req.param('id')

  const [epic] = await db
    .select()
    .from(epics)
    .where(eq(epics.id, id))

  if (!epic) {
    return c.json({ error: 'Epic not found' }, 404)
  }

  await db
    .update(epics)
    .set({ backlogStatus: 'admitted' })
    .where(eq(epics.id, id))

  return c.json({ success: true, backlogStatus: 'admitted' })
})

// ── POST /epics/:id/reject ───────────────────────────────────────

app.post('/epics/:id/reject', async (c) => {
  const id = c.req.param('id')

  const [epic] = await db
    .select()
    .from(epics)
    .where(eq(epics.id, id))

  if (!epic) {
    return c.json({ error: 'Epic not found' }, 404)
  }

  await db
    .update(epics)
    .set({ backlogStatus: 'rejected' })
    .where(eq(epics.id, id))

  return c.json({ success: true, backlogStatus: 'rejected' })
})

// ── GET /projects/:projectId/backlog ──────────────────────────────

app.get('/projects/:projectId/backlog', async (c) => {
  const projectId = c.req.param('projectId')

  const backlogEpics = await db
    .select()
    .from(epics)
    .where(
      and(eq(epics.projectId, projectId), eq(epics.backlogStatus, 'admitted')),
    )
    .orderBy(desc(epics.averageScore))

  const result = []
  for (const epic of backlogEpics) {
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

    result.push({
      ...epic,
      averageScore: epic.averageScore / 10,
      features: featureList,
    })
  }

  return c.json(result)
})

export { app as epicRoutes }
