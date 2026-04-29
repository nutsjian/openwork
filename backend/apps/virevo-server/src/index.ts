import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { projectRoutes } from '@/routes/projects'
import { sessionRoutes } from '@/routes/sessions'
import { projectMinuteRoutes, minuteRoutes } from '@/routes/minutes'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:*'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }),
)

app.get('/api/v1/health', (c) => c.json({ status: 'ok' }))

app.route('/api/v1/projects', projectRoutes)
app.route('/api/v1/projects', projectMinuteRoutes)
app.route('/api/v1/sessions', sessionRoutes)
app.route('/api/v1/minutes', minuteRoutes)

const port = Number(process.env.PORT) || 13179

console.log(`virevo-server starting on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
