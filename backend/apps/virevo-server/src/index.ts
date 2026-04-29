import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { projectRoutes } from '@/routes/projects'
import { sessionRoutes } from '@/routes/sessions'
import { minuteRoutes } from '@/routes/minutes'

const app = new Hono()

// ── Middleware ────────────────────────────────────────────────────

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:*'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }),
)

// ── Routes ───────────────────────────────────────────────────────

app.get('/api/v1/health', (c) => c.json({ status: 'ok' }))

app.route('/api/v1/projects', projectRoutes)
app.route('/api/v1/sessions', sessionRoutes)
app.route('/api/v1/minutes', minuteRoutes)

// ── Start ────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 3001

console.log(`🚀 virevo-server starting on http://localhost:${port}`)

export default app
